// SPDX-License-Identifier: GPL-2.0-or-later
// Original RoomGoblin adapter for the separately licensed community protocols.
#include "RoomGoblinWebBridge.h"
#include "VeyonCore.h"
#include "VeyonConfiguration.h"
#include "VncConnection.h"
#include <QDateTime>
#include <QMutexLocker>
#include <utility>

namespace {
const Feature::Uid Chat{"8a9e0f1d-2c3b-4467-a987-654321fedcba"};
const Feature::Uid Files{"b1d9f27a-4c86-4f1e-9a3d-6e0c85f7b214"};
constexpr qint64 MaxFile = 8 * 1024 * 1024;
FeatureMessage message(Feature::Uid uid, int command) {
    return FeatureMessage{uid, static_cast<FeatureMessage::Command>(command)};
}
QVariantMap failure(const QString& error) { return {{QStringLiteral("ok"),false},{QStringLiteral("error"),error}}; }
bool permitted(Feature::Uid feature) {
    for (const auto& disabled : VeyonCore::config().disabledFeatures())
        if (Feature::Uid{disabled} == feature) return false;
    return true;
}
bool textArgument(const QVariantMap& data, const QString& key, int maximum) {
    const auto value=data.value(key);
    return value.metaType().id()==QMetaType::QString && !value.toString().isEmpty()
        && value.toString().size()<=maximum && !value.toString().contains(QChar{0});
}
}

QVariantMap RoomGoblinWebBridge::browserRequest(ComputerControlInterface::Pointer client,
                                                const QString& action, const QVariantMap& data)
{
    if (!client || !client->vncConnection() || !client->vncConnection()->isConnected())
        return failure(QStringLiteral("Endpoint disconnected"));
    QMutexLocker lock(&m_browserMutex);
    const auto now=QDateTime::currentMSecsSinceEpoch();
    for (auto it=m_browserSessions.begin();it!=m_browserSessions.end();) {
        if (it->client.isNull() || it->expires<now) it=m_browserSessions.erase(it); else ++it;
    }
    if (action==QStringLiteral("capabilities"))
        return {{QStringLiteral("ok"),true},{QStringLiteral("protocol"),1},
                {QStringLiteral("chat"),permitted(Chat)},{QStringLiteral("files"),permitted(Files)}};
    const auto token=data.value(QStringLiteral("session")).toString();
    if (QUuid{token}.isNull()) return failure(QStringLiteral("Invalid browser session"));
    if (action==QStringLiteral("open")) {
        const auto kind=data.value(QStringLiteral("kind")).toString();
        if ((kind!=QStringLiteral("chat") && kind!=QStringLiteral("files")) ||
            !permitted(kind==QStringLiteral("chat")?Chat:Files)) return failure(QStringLiteral("Feature unavailable"));
        for (const auto& session : std::as_const(m_browserSessions))
            if (session.client.toStrongRef()==client) return failure(QStringLiteral("Close the existing browser session first"));
        if (m_browserSessions.size()>=8 || m_browserSessions.contains(token)) return failure(QStringLiteral("Browser session limit"));
        BrowserSession session;
        session.client=client; session.kind=kind; session.context=QUuid::createUuid(); session.expires=now+15*60*1000;
        m_browserSessions.insert(token,session);
        if (kind==QStringLiteral("chat"))
            sendFeatureMessage(message(Chat,10).addArgument(0,session.context),{client});
        return {{QStringLiteral("ok"),true},{QStringLiteral("accepted"),true},{QStringLiteral("endpointVerified"),false}};
    }
    auto it=m_browserSessions.find(token);
    if (it==m_browserSessions.end() || it->client.toStrongRef()!=client) return failure(QStringLiteral("Browser session expired or connection changed"));
    auto& session=it.value();
    if (action==QStringLiteral("close")) {
        if (session.kind==QStringLiteral("chat")) sendFeatureMessage(message(Chat,13).addArgument(0,session.context),{client});
        else sendFeatureMessage(message(Files,3).addArgument(3,session.transfer),{client});
        m_browserSessions.erase(it);
        return {{QStringLiteral("ok"),true}};
    }
    if (!permitted(session.kind==QStringLiteral("chat")?Chat:Files)) return failure(QStringLiteral("Feature disabled"));
    if (session.pending && now>session.deadline) {
        session.pending=false; session.error=QStringLiteral("Endpoint response timed out"); session.bytes.clear();
        session.transfer={}; session.request={};
    }
    if (action==QStringLiteral("state"))
        return {{QStringLiteral("ok"),true},{QStringLiteral("messages"),session.messages},
                {QStringLiteral("entries"),session.entries},{QStringLiteral("path"),session.path},
                {QStringLiteral("pending"),session.pending},{QStringLiteral("error"),session.error},
                {QStringLiteral("complete"),session.complete},{QStringLiteral("size"),session.size},
                {QStringLiteral("received"),session.bytes.size()},{QStringLiteral("fileName"),session.fileName}};
    if (session.kind==QStringLiteral("chat")) {
        if (action!=QStringLiteral("send") || !textArgument(data,QStringLiteral("text"),2000))
            return failure(QStringLiteral("Enter 1–2000 characters"));
        const auto text=data.value(QStringLiteral("text")).toString();
        sendFeatureMessage(message(Chat,11).addArgument(0,session.context).addArgument(1,text),{client});
        session.messages.append(QVariantMap{{QStringLiteral("from"),QStringLiteral("teacher (sent, unverified)")},{QStringLiteral("text"),text}});
        while (session.messages.size()>100) session.messages.removeFirst();
        return {{QStringLiteral("ok"),true},{QStringLiteral("accepted"),true}};
    }
    if (action==QStringLiteral("chunk")) {
        bool valid=false; const auto offset=data.value(QStringLiteral("offset")).toLongLong(&valid);
        if (!valid || offset<0 || !session.complete || offset>session.bytes.size()) return failure(QStringLiteral("File not complete or invalid offset"));
        return {{QStringLiteral("ok"),true},{QStringLiteral("data"),QString::fromLatin1(session.bytes.mid(offset,128*1024).toBase64())}};
    }
    if (session.pending) return failure(QStringLiteral("Wait for the current file request"));
    if (action!=QStringLiteral("roots") && action!=QStringLiteral("list") && action!=QStringLiteral("download"))
        return failure(QStringLiteral("Unsupported browser action"));
    if (action!=QStringLiteral("roots") && !textArgument(data,QStringLiteral("path"),4096))
        return failure(QStringLiteral("Invalid path"));
    session.error.clear(); session.entries.clear(); session.bytes.clear(); session.complete=false; session.size=-1;
    session.pending=true; session.deadline=now+60000; session.request=QUuid::createUuid(); session.transfer={};
    session.path=data.value(QStringLiteral("path")).toString();
    if (action==QStringLiteral("download")) {
        session.transfer=QUuid::createUuid();
        sendFeatureMessage(message(Files,2).addArgument(3,session.transfer).addArgument(1,session.path),{client});
    } else sendFeatureMessage(message(Files,action==QStringLiteral("roots")?0:1)
                             .addArgument(0,session.request).addArgument(1,session.path),{client});
    return {{QStringLiteral("ok"),true},{QStringLiteral("accepted"),true}};
}

bool RoomGoblinWebBridge::handleFeatureMessage(ComputerControlInterface::Pointer client, const FeatureMessage& msg)
{
    if (msg.featureUid()!=Chat && msg.featureUid()!=Files) return false;
    QMutexLocker lock(&m_browserMutex);
    const auto now=QDateTime::currentMSecsSinceEpoch();
    for (auto& session : m_browserSessions) {
        if (session.client.toStrongRef()!=client || session.expires<now) continue;
        const int command=msg.command<int>();
        if (msg.featureUid()==Chat && session.kind==QStringLiteral("chat") && command==12 && msg.argument(0).toUuid()==session.context) {
            const auto text=msg.argument(1).toString();
            if (text.isEmpty() || text.size()>2000 || text.contains(QChar{0})) return true;
            session.messages.append(QVariantMap{{QStringLiteral("from"),QStringLiteral("student")},{QStringLiteral("text"),text}});
            while (session.messages.size()>100) session.messages.removeFirst();
            return true;
        }
        if (msg.featureUid()!=Files || session.kind!=QStringLiteral("files") || !session.pending || now>session.deadline) continue;
        if ((command==5 || command==6) && !session.request.isNull() && msg.argument(0).toUuid()==session.request) {
            const auto entries=msg.argument(2).toList();
            session.pending=false; session.request={};
            if (entries.size()>1000) session.error=QStringLiteral("Directory exceeds limit");
            else {session.entries=entries;session.error=msg.argument(7).toString().left(500);}
            return true;
        }
        if (session.transfer.isNull() || msg.argument(3).toUuid()!=session.transfer) continue;
        if (command==7) {
            session.size=msg.argument(5).toLongLong(); session.fileName=msg.argument(4).toString().left(255);
            if (!msg.argument(7).toString().isEmpty() || session.size<0 || session.size>MaxFile)
                session.error=QStringLiteral("File unavailable or exceeds 8 MiB browser limit");
        } else if (command==8) {
            const auto chunk=msg.argument(6).toByteArray();
            if (session.size<0 || chunk.size()>128*1024 || session.bytes.size()+chunk.size()>session.size)
                session.error=QStringLiteral("Invalid transfer length");
            else session.bytes.append(chunk);
        } else if (command==9) {
            if (session.size<0 || session.bytes.size()!=session.size || !msg.argument(7).toString().isEmpty())
                session.error=QStringLiteral("Incomplete transfer");
            else session.complete=true;
            session.pending=false;
        }
        if (!session.error.isEmpty()) {
            session.bytes.clear(); session.pending=false; session.complete=false;
            sendFeatureMessage(message(Files,3).addArgument(3,session.transfer),{client}); session.transfer={};
        }
        return true;
    }
    return false;
}
