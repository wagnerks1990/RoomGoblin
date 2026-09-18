// SPDX-License-Identifier: GPL-2.0-or-later
// Original RoomGoblin adapter for the separately licensed community protocols.
#include "RoomGoblinWebBridge.h"
#include "VeyonCore.h"
#include "VeyonConfiguration.h"
#include "VncConnection.h"
#include <QDateTime>
#include <QCryptographicHash>
#include <QMutexLocker>
#include <QMap>
#include <QThread>
#include <algorithm>
#include <utility>

namespace {
const Feature::Uid Chat{"8a9e0f1d-2c3b-4467-a987-654321fedcba"};
const Feature::Uid Files{"b1d9f27a-4c86-4f1e-9a3d-6e0c85f7b214"};
const Feature::Uid ClipboardRead{"9fd323eb-5ae1-4552-8a4c-8b18837b78f7"};
const Feature::Uid Terminal{"b6e98d71-41ad-4d2d-8c9e-7624db7a6cb0"};
constexpr qint64 MaxFile = 8 * 1024 * 1024;
constexpr qint64 MaxUpload = 2 * 1024 * 1024;
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

const QMap<QString, unsigned int>& keyMap()
{
    static const QMap<QString, unsigned int> keys{
        {QStringLiteral("Backspace"),0xff08},{QStringLiteral("Tab"),0xff09},
        {QStringLiteral("Enter"),0xff0d},{QStringLiteral("Escape"),0xff1b},
        {QStringLiteral("Delete"),0xffff},{QStringLiteral("Home"),0xff50},
        {QStringLiteral("Left"),0xff51},{QStringLiteral("Up"),0xff52},
        {QStringLiteral("Right"),0xff53},{QStringLiteral("Down"),0xff54},
        {QStringLiteral("PageUp"),0xff55},{QStringLiteral("PageDown"),0xff56},
        {QStringLiteral("End"),0xff57},{QStringLiteral("Insert"),0xff63},
        {QStringLiteral("Shift"),0xffe1},{QStringLiteral("Control"),0xffe3},
        {QStringLiteral("Alt"),0xffe9},{QStringLiteral("Meta"),0xffeb},
        {QStringLiteral("F1"),0xffbe},{QStringLiteral("F2"),0xffbf},
        {QStringLiteral("F3"),0xffc0},{QStringLiteral("F4"),0xffc1},
        {QStringLiteral("F5"),0xffc2},{QStringLiteral("F6"),0xffc3},
        {QStringLiteral("F7"),0xffc4},{QStringLiteral("F8"),0xffc5},
        {QStringLiteral("F9"),0xffc6},{QStringLiteral("F10"),0xffc7},
        {QStringLiteral("F11"),0xffc8},{QStringLiteral("F12"),0xffc9},
        {QStringLiteral(" "),0x20},{QStringLiteral("!"),0x21},{QStringLiteral("\""),0x22},
        {QStringLiteral("#"),0x23},{QStringLiteral("$"),0x24},{QStringLiteral("%"),0x25},
        {QStringLiteral("&"),0x26},{QStringLiteral("'"),0x27},{QStringLiteral("("),0x28},
        {QStringLiteral(")"),0x29},{QStringLiteral("*"),0x2a},{QStringLiteral("+"),0x2b},
        {QStringLiteral(","),0x2c},{QStringLiteral("-"),0x2d},{QStringLiteral("."),0x2e},
        {QStringLiteral("/"),0x2f},{QStringLiteral(":"),0x3a},{QStringLiteral(";"),0x3b},
        {QStringLiteral("<"),0x3c},{QStringLiteral("="),0x3d},{QStringLiteral(">"),0x3e},
        {QStringLiteral("?"),0x3f},{QStringLiteral("@"),0x40},{QStringLiteral("["),0x5b},
        {QStringLiteral("\\"),0x5c},{QStringLiteral("]"),0x5d},{QStringLiteral("^"),0x5e},
        {QStringLiteral("_"),0x5f},{QStringLiteral("`"),0x60},{QStringLiteral("{"),0x7b},
        {QStringLiteral("|"),0x7c},{QStringLiteral("}"),0x7d},{QStringLiteral("~"),0x7e}
    };
    return keys;
}

unsigned int keySym(const QString& name)
{
    if (const auto mapped=keyMap().value(name,0); mapped) return mapped;
    const auto points=name.toUcs4();
    if (points.size()!=1 || points[0]<0x20 || points[0]==0x7f || points[0]>0x10ffff) return 0;
    return points[0]<=0xff ? points[0] : 0x01000000U|points[0];
}

QString topologyFor(const ComputerControlInterface::Pointer& client)
{
    QByteArray value;
    for (const auto& screen : client->screens())
        value.append(QByteArray::number(screen.index)).append(':').append(screen.name.toUtf8()).append(':')
            .append(QByteArray::number(screen.geometry.x())).append(',').append(QByteArray::number(screen.geometry.y())).append(',')
            .append(QByteArray::number(screen.geometry.width())).append(',').append(QByteArray::number(screen.geometry.height())).append(';');
    value.append(QByteArray::number(client->framebuffer().width())).append('x').append(QByteArray::number(client->framebuffer().height()));
    return QString::fromLatin1(QCryptographicHash::hash(value,QCryptographicHash::Sha256).toHex());
}
}

void RoomGoblinWebBridge::releaseInput(BrowserSession& session)
{
    const auto client=session.client.toStrongRef();
    const auto keys=session.pressedKeys; const auto x=session.pointerX,y=session.pointerY,mask=session.pointerMask;
    session.pressedKeys.clear(); session.pointerMask=0; session.inputDeadline=0;
    if (client && client->thread()!=QThread::currentThread()) {
        const QWeakPointer<ComputerControlInterface> weak=client;
        QMetaObject::invokeMethod(client.data(),[weak,keys,x,y,mask]() {
            const auto current=weak.toStrongRef(); auto* connection=current?current->vncConnection():nullptr;
            if (!connection || !connection->isConnected()) return;
            for (const auto key : keys) connection->keyEvent(key,false);
            if (mask) connection->mouseEvent(x,y,0);
        },Qt::QueuedConnection);
        return;
    }
    auto* connection=client ? client->vncConnection() : nullptr;
    if (connection && connection->isConnected()) {
        for (const auto key : keys) connection->keyEvent(key,false);
        if (mask) connection->mouseEvent(x,y,0);
    }
}

void RoomGoblinWebBridge::closeBrowserSession(BrowserSession& session)
{
    releaseInput(session);
    QObject::disconnect(session.frameConnection);
    const auto client=session.client.toStrongRef();
    if (client && session.kind==QStringLiteral("control")) {
        const auto mode=session.previousUpdateMode;
        if (client->thread()==QThread::currentThread()) client->setUpdateMode(mode);
        else { const QWeakPointer<ComputerControlInterface> weak=client; QMetaObject::invokeMethod(client.data(),[weak,mode]() { const auto current=weak.toStrongRef(); if(current) current->setUpdateMode(mode); },Qt::QueuedConnection); }
    }
}

void RoomGoblinWebBridge::pruneBrowserSessions()
{
    QMutexLocker lock(&m_browserMutex);
    const auto now=QDateTime::currentMSecsSinceEpoch();
    for (auto it=m_browserSessions.begin();it!=m_browserSessions.end();) {
        if (it->inputDeadline && it->inputDeadline<now) releaseInput(it.value());
        if (it->client.isNull() || it->expires<now) {
            const auto client=it->client.toStrongRef();
            closeBrowserSession(it.value());
            if (client && it->kind==QStringLiteral("chat"))
                sendFeatureMessage(message(Chat,13).addArgument(0,it->context),{client});
            if (client && it->kind==QStringLiteral("files"))
                sendFeatureMessage(message(Files,4).addArgument(3,it->transfer),{client});
            if (client && it->kind==QStringLiteral("terminal"))
                sendFeatureMessage(message(Terminal,3).addArgument(0,it->context),{client});
            it=m_browserSessions.erase(it);
        } else ++it;
    }
}

QVariantMap RoomGoblinWebBridge::browserRequest(ComputerControlInterface::Pointer client,
                                                const QString& action, const QVariantMap& data)
{
    if (!client || !client->vncConnection() || !client->vncConnection()->isConnected())
        return failure(QStringLiteral("Endpoint disconnected"));
    QMutexLocker lock(&m_browserMutex);
    const auto now=QDateTime::currentMSecsSinceEpoch();
    for (auto& session : m_browserSessions)
        if (session.inputDeadline && session.inputDeadline<now) releaseInput(session);
    if (action==QStringLiteral("capabilities"))
        return {{QStringLiteral("ok"),true},{QStringLiteral("protocol"),1},
                {QStringLiteral("chat"),permitted(Chat)},{QStringLiteral("files"),permitted(Files)},
                {QStringLiteral("upload"),permitted(Files)},
                {QStringLiteral("control"),allowed(false)},
                {QStringLiteral("terminal"),terminalAllowed()}};
    const auto token=data.value(QStringLiteral("session")).toString();
    if (QUuid{token}.isNull()) return failure(QStringLiteral("Invalid browser session"));
    if (action==QStringLiteral("open")) {
        const auto kind=data.value(QStringLiteral("kind")).toString();
        if ((kind!=QStringLiteral("chat") && kind!=QStringLiteral("files") && kind!=QStringLiteral("control") && kind!=QStringLiteral("terminal")) ||
            (kind==QStringLiteral("chat") && !permitted(Chat)) ||
            (kind==QStringLiteral("files") && !permitted(Files)) ||
            (kind==QStringLiteral("control") && !allowed(false)) ||
            (kind==QStringLiteral("terminal") && !terminalAllowed())) return failure(QStringLiteral("Feature unavailable"));
        for (const auto& session : std::as_const(m_browserSessions))
            if (session.client.toStrongRef()==client) return failure(QStringLiteral("Close the existing browser session first"));
        if (kind==QStringLiteral("control") && std::count_if(m_browserSessions.cbegin(),m_browserSessions.cend(),[](const auto& item){return item.kind==QStringLiteral("control");})>=4)
            return failure(QStringLiteral("Remote control session limit"));
        if (kind==QStringLiteral("terminal") && std::count_if(m_browserSessions.cbegin(),m_browserSessions.cend(),[](const auto& item){return item.kind==QStringLiteral("terminal");})>=2)
            return failure(QStringLiteral("Terminal session limit"));
        if (m_browserSessions.size()>=8 || m_browserSessions.contains(token)) return failure(QStringLiteral("Browser session limit"));
        BrowserSession session;
        session.client=client; session.kind=kind; session.context=QUuid::createUuid(); session.expires=now+15*60*1000;
        if (kind==QStringLiteral("control")) {
            session.expires=now+10*60*1000;
            session.previousUpdateMode=client->updateMode();
            client->setUpdateMode(ComputerControlInterface::UpdateMode::Live);
            const QWeakPointer<ComputerControlInterface> weak=client;
            session.frameConnection=connect(client.data(),&ComputerControlInterface::framebufferUpdated,this,[this,weak]() {
                QMutexLocker guard(&m_browserMutex); const auto current=weak.toStrongRef();
                if (!current) return;
                for (auto& item : m_browserSessions) if (item.kind==QStringLiteral("control") && item.client.toStrongRef()==current) {
                    item.lastFrameMs=QDateTime::currentMSecsSinceEpoch(); ++item.frameRevision;
                }
            });
        }
        if (kind==QStringLiteral("terminal")) {
            const auto shell=data.value(QStringLiteral("shell")).toString();
            if (shell!=QStringLiteral("cmd") && shell!=QStringLiteral("powershell"))
                return failure(QStringLiteral("Choose CMD or Windows PowerShell"));
            session.expires=now+10*60*1000; session.deadline=now+5000;
            session.pending=true; session.terminalShell=shell;
        }
        m_browserSessions.insert(token,session);
        if (kind==QStringLiteral("chat"))
            sendFeatureMessage(message(Chat,10).addArgument(0,session.context),{client});
        if (kind==QStringLiteral("terminal"))
            sendFeatureMessage(message(Terminal,1).addArgument(0,session.context).addArgument(1,session.terminalShell),{client});
        return {{QStringLiteral("ok"),true},{QStringLiteral("accepted"),true},{QStringLiteral("endpointVerified"),false}};
    }
    auto it=m_browserSessions.find(token);
    if (it==m_browserSessions.end() || it->client.toStrongRef()!=client) return failure(QStringLiteral("Browser session expired or connection changed"));
    auto& session=it.value();
    if (action==QStringLiteral("close")) {
        if (session.kind==QStringLiteral("chat")) sendFeatureMessage(message(Chat,13).addArgument(0,session.context),{client});
        else if (session.kind==QStringLiteral("files")) sendFeatureMessage(message(Files,4).addArgument(3,session.transfer),{client});
        else if (session.kind==QStringLiteral("terminal")) sendFeatureMessage(message(Terminal,3).addArgument(0,session.context),{client});
        else closeBrowserSession(session);
        m_browserSessions.erase(it);
        return {{QStringLiteral("ok"),true}};
    }
    if ((session.kind==QStringLiteral("chat") && !permitted(Chat)) ||
        (session.kind==QStringLiteral("files") && !permitted(Files)) ||
        (session.kind==QStringLiteral("control") && !allowed(false)) ||
        (session.kind==QStringLiteral("terminal") && !terminalAllowed())) return failure(QStringLiteral("Feature disabled"));
    if (session.pending && now>session.deadline) {
        if (session.kind==QStringLiteral("files"))
            sendFeatureMessage(message(Files,4).addArgument(3,session.transfer),{client});
        session.pending=false; session.error=QStringLiteral("Endpoint response timed out"); session.bytes.clear();
        session.transfer={}; session.request={};
    }
    if (action==QStringLiteral("state")) {
        if (session.kind==QStringLiteral("terminal") && session.pending && now>session.deadline) {
            session.pending=false; session.terminalExited=true;
            session.error=QStringLiteral("Endpoint did not start the terminal");
            sendFeatureMessage(message(Terminal,3).addArgument(0,session.context),{client});
        }
        QVariantList screens;
        if (session.kind==QStringLiteral("control")) {
            QPoint minimum{};
            for (const auto& screen : client->screens()) {
                minimum.setX(qMin(minimum.x(),screen.geometry.x()));
                minimum.setY(qMin(minimum.y(),screen.geometry.y()));
            }
            for (const auto& screen : client->screens().mid(0,16)) screens.append(QVariantMap{
                {QStringLiteral("index"),screen.index},{QStringLiteral("name"),screen.name.left(100)},
                {QStringLiteral("x"),screen.geometry.x()-minimum.x()},{QStringLiteral("y"),screen.geometry.y()-minimum.y()},
                {QStringLiteral("width"),screen.geometry.width()},{QStringLiteral("height"),screen.geometry.height()}});
            const auto currentTopology=topologyFor(client);
            const bool topologyChanged=session.topology!=currentTopology;
            session.topology=currentTopology;
            if (client->hasValidFramebuffer() && session.lastFrameMs && now-session.lastFrameMs<=2000) {
                if (session.lease.isEmpty() || topologyChanged || session.leaseRevision!=session.frameRevision)
                    session.lease=QUuid::createUuid().toString(QUuid::WithoutBraces);
                session.leaseRevision=session.frameRevision; session.leaseDeadline=now+1500;
            } else { session.lease.clear(); session.leaseDeadline=0; }
        }
        return {{QStringLiteral("ok"),true},{QStringLiteral("messages"),session.messages},
                {QStringLiteral("entries"),session.entries},{QStringLiteral("path"),session.path},
                {QStringLiteral("pending"),session.pending},{QStringLiteral("error"),session.error},
                {QStringLiteral("complete"),session.complete},{QStringLiteral("size"),session.size},
                {QStringLiteral("received"),session.bytes.size()},{QStringLiteral("fileName"),session.fileName},
                {QStringLiteral("screens"),screens},{QStringLiteral("frameWidth"),client->framebuffer().width()},
                {QStringLiteral("frameHeight"),client->framebuffer().height()},
                {QStringLiteral("ready"),!session.lease.isEmpty()},{QStringLiteral("lease"),session.lease},
                {QStringLiteral("frameRevision"),static_cast<qulonglong>(session.leaseRevision)},
                {QStringLiteral("topology"),session.topology},
                {QStringLiteral("terminalReady"),session.terminalReady},
                {QStringLiteral("terminalExited"),session.terminalExited},
                {QStringLiteral("terminalBase"),session.terminalBase},
                {QStringLiteral("terminalEnd"),session.terminalBase+session.terminalOutput.size()},
                {QStringLiteral("shell"),session.terminalShell}};
    }
    if (session.kind==QStringLiteral("terminal")) {
        if (action==QStringLiteral("terminalRead")) {
            bool offsetOk=false; auto offset=data.value(QStringLiteral("offset")).toLongLong(&offsetOk);
            if (!offsetOk || offset<0) return failure(QStringLiteral("Invalid terminal offset"));
            bool reset=offset<session.terminalBase || offset>session.terminalBase+session.terminalOutput.size();
            if (reset) offset=session.terminalBase;
            const auto start=static_cast<int>(offset-session.terminalBase);
            const auto text=session.terminalOutput.mid(start,32768);
            return {{QStringLiteral("ok"),true},{QStringLiteral("text"),text},
                    {QStringLiteral("cursor"),offset+text.size()},{QStringLiteral("reset"),reset},
                    {QStringLiteral("ready"),session.terminalReady},{QStringLiteral("exited"),session.terminalExited},
                    {QStringLiteral("error"),session.error}};
        }
        if (action==QStringLiteral("terminalWrite")) {
            const auto value=data.value(QStringLiteral("text"));
            if (!session.terminalReady || session.terminalExited || value.metaType().id()!=QMetaType::QString ||
                !textArgument(data,QStringLiteral("text"),4096) || value.toString().toUtf8().size()>4096)
                return failure(QStringLiteral("Terminal is not ready or input is invalid"));
            sendFeatureMessage(message(Terminal,2).addArgument(0,session.context)
                               .addArgument(2,value.toString()).addArgument(3,++session.terminalInputSequence),{client});
            return {{QStringLiteral("ok"),true},{QStringLiteral("accepted"),true}};
        }
        return failure(QStringLiteral("Unsupported terminal action"));
    }
    if (session.kind==QStringLiteral("control")) {
        auto* connection=client->vncConnection();
        if (action==QStringLiteral("clipboard")) {
            if (!allowed()) return failure(QStringLiteral("Clipboard read is disabled"));
            if (session.clipboardPending && now>session.deadline) {
                session.clipboardPending=false; session.clipboardRequest={};
                return {{QStringLiteral("ok"),true},{QStringLiteral("pending"),false},{QStringLiteral("error"),QStringLiteral("Clipboard response timed out")}};
            }
            if (session.clipboardReady) {
                session.clipboardReady=false; const auto text=session.clipboardText,error=session.error;
                session.clipboardText.clear(); session.error.clear();
                return {{QStringLiteral("ok"),true},{QStringLiteral("pending"),false},{QStringLiteral("text"),text},{QStringLiteral("error"),error}};
            }
            if (!session.clipboardPending) {
                session.clipboardRequest=QUuid::createUuid(); session.clipboardPending=true; session.deadline=now+5000; session.error.clear();
                sendFeatureMessage(message(ClipboardRead,1).addArgument(0,session.clipboardRequest),{client});
            }
            return {{QStringLiteral("ok"),true},{QStringLiteral("pending"),true},{QStringLiteral("error"),session.error}};
        }
        if (!client->hasValidFramebuffer() || !connection || !connection->isConnected()) return failure(QStringLiteral("Remote control framebuffer unavailable"));
        bool sequenceOk=false,revisionOk=false;
        const auto sequence=data.value(QStringLiteral("sequence")).toULongLong(&sequenceOk);
        const auto revision=data.value(QStringLiteral("revision")).toULongLong(&revisionOk);
        if (!sequenceOk || !revisionOk || sequence<=session.inputSequence)
            return failure(QStringLiteral("Invalid remote input sequence"));
        bool isRelease=false,xOk=false,yOk=false,maskOk=false,wheelOk=true;
        int x=0,y=0,mask=0,wheel=0; unsigned int key=0; bool pressed=false;
        if (action==QStringLiteral("pointer")) {
            x=data.value(QStringLiteral("x")).toInt(&xOk); y=data.value(QStringLiteral("y")).toInt(&yOk);
            mask=data.value(QStringLiteral("buttons")).toInt(&maskOk);
            wheel=data.contains(QStringLiteral("wheel"))?data.value(QStringLiteral("wheel")).toInt(&wheelOk):0;
            if (!xOk || !yOk || !maskOk || mask<0 || (mask&~7) || !wheelOk || wheel<-1 || wheel>1)
                return failure(QStringLiteral("Invalid pointer event"));
            isRelease=mask!=session.pointerMask && (mask&~session.pointerMask)==0;
            if (isRelease && wheel) return failure(QStringLiteral("Invalid pointer release"));
        } else if (action==QStringLiteral("key")) {
            const auto name=data.value(QStringLiteral("key")); const auto pressedValue=data.value(QStringLiteral("pressed"));
            if (name.metaType().id()!=QMetaType::QString || pressedValue.metaType().id()!=QMetaType::Bool)
                return failure(QStringLiteral("Invalid key event"));
            key=keySym(name.toString()); pressed=pressedValue.toBool();
            if (!key) return failure(QStringLiteral("Unsupported key event"));
            isRelease=!pressed && session.pressedKeys.contains(key);
        } else return failure(QStringLiteral("Unsupported remote control action"));
        const bool freshLease=data.value(QStringLiteral("lease")).toString()==session.lease && !session.lease.isEmpty() &&
            revision==session.leaseRevision && session.leaseDeadline>=now &&
            now-session.lastFrameMs<=2000 && topologyFor(client)==session.topology;
        // Releases for keys/buttons held by this exact session remain available
        // after a frame/lease change, preventing stuck input without granting a
        // new press or wheel action against stale screen content.
        if (!isRelease && !freshLease)
            return failure(QStringLiteral("Remote input lease expired; wait for a fresh frame"));
        if (now-session.rateWindow>=1000) { session.rateWindow=now; session.eventCount=0; }
        if (!isRelease && (++session.eventCount>25 || !connection->isEventQueueEmpty())) return failure(QStringLiteral("Remote input queue busy"));
        session.inputSequence=sequence;
        if (action==QStringLiteral("pointer")) {
            if (!isRelease && (x<0 || y<0 || x>=client->framebuffer().width() || y>=client->framebuffer().height()))
                return failure(QStringLiteral("Invalid pointer event"));
            if (isRelease) { x=qBound(0,session.pointerX,client->framebuffer().width()-1); y=qBound(0,session.pointerY,client->framebuffer().height()-1); }
            if (wheel) connection->mouseEvent(x,y,mask|(wheel<0?8:16));
            connection->mouseEvent(x,y,mask); session.pointerX=x; session.pointerY=y; session.pointerMask=mask;
            session.inputDeadline=(session.pointerMask||!session.pressedKeys.isEmpty())?now+2000:0;
            return {{QStringLiteral("ok"),true},{QStringLiteral("accepted"),true}};
        }
        if (action==QStringLiteral("key")) {
            if (!key || (pressed && session.pressedKeys.size()>=16)) return failure(QStringLiteral("Unsupported key event"));
            if (pressed && !session.pressedKeys.contains(key)) { connection->keyEvent(key,true); session.pressedKeys.insert(key); }
            if (!pressed && session.pressedKeys.remove(key)) connection->keyEvent(key,false);
            session.inputDeadline=(session.pressedKeys.isEmpty() && !session.pointerMask)?0:now+2000;
            return {{QStringLiteral("ok"),true},{QStringLiteral("accepted"),true}};
        }
        return failure(QStringLiteral("Unsupported remote control action"));
    }
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
    if (action==QStringLiteral("uploadStart")) {
        if (session.pending) return failure(QStringLiteral("Wait for the current file request"));
        const auto name=data.value(QStringLiteral("name")).toString(); bool sizeOk=false;
        const auto size=data.value(QStringLiteral("size")).toLongLong(&sizeOk);
        if (name.isEmpty() || name.size()>255 || name==QStringLiteral(".") || name==QStringLiteral("..") ||
            name.contains(QLatin1Char('/')) || name.contains(QLatin1Char('\\')) || !sizeOk || size<0 || size>MaxUpload)
            return failure(QStringLiteral("Choose one ordinary file up to 2 MiB"));
        session.error.clear(); session.complete=false; session.upload=true; session.uploadOffset=0;
        session.size=size; session.fileName=name; session.transfer=QUuid::createUuid();
        session.pending=true; session.deadline=now+60000;
        sendFeatureMessage(message(Files,10).addArgument(3,session.transfer).addArgument(4,name).addArgument(5,size),{client});
        return {{QStringLiteral("ok"),true},{QStringLiteral("accepted"),true}};
    }
    if (action==QStringLiteral("uploadChunk")) {
        bool offsetOk=false; const auto offset=data.value(QStringLiteral("offset")).toLongLong(&offsetOk);
        const auto encoded=data.value(QStringLiteral("data")).toString().toLatin1();
        const auto bytes=QByteArray::fromBase64(encoded,QByteArray::AbortOnBase64DecodingErrors);
        if (!session.pending || !session.upload || !offsetOk || offset!=session.uploadOffset || bytes.isEmpty() ||
            bytes.size()>128*1024 || session.uploadOffset+bytes.size()>session.size || encoded.size()>180*1024)
            return failure(QStringLiteral("Invalid upload chunk"));
        sendFeatureMessage(message(Files,11).addArgument(3,session.transfer).addArgument(8,offset).addArgument(6,bytes),{client});
        session.uploadOffset+=bytes.size(); session.deadline=now+60000;
        return {{QStringLiteral("ok"),true},{QStringLiteral("accepted"),true},{QStringLiteral("received"),session.uploadOffset}};
    }
    if (action==QStringLiteral("uploadFinish")) {
        if (!session.pending || !session.upload || session.uploadOffset!=session.size)
            return failure(QStringLiteral("Upload is incomplete"));
        sendFeatureMessage(message(Files,12).addArgument(3,session.transfer),{client});
        session.deadline=now+60000;
        return {{QStringLiteral("ok"),true},{QStringLiteral("accepted"),true}};
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
    if (msg.featureUid()==Terminal) return handleTerminalMaster(client,msg);
    if (msg.featureUid()!=Chat && msg.featureUid()!=Files && msg.featureUid()!=ClipboardRead) return false;
    QMutexLocker lock(&m_browserMutex);
    const auto now=QDateTime::currentMSecsSinceEpoch();
    for (auto& session : m_browserSessions) {
        if (session.client.toStrongRef()!=client || session.expires<now) continue;
        if (msg.featureUid()==ClipboardRead && session.kind==QStringLiteral("control") && msg.command<int>()==2 &&
            msg.argument(0).toUuid()==session.clipboardRequest && session.clipboardPending) {
            const auto text=msg.argument(1).toString();
            session.clipboardPending=false; session.clipboardRequest={};
            if (msg.argument(2).toString().isEmpty() && !text.contains(QChar{0}) && text.toUtf8().size()<=8192) {
                session.clipboardText=text; session.clipboardReady=true;
            } else { session.error=QStringLiteral("Clipboard is unavailable or exceeds 8 KiB"); session.clipboardReady=true; }
            return true;
        }
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
        if (command==14 && session.upload) {
            session.error=msg.argument(7).toString().left(500); session.pending=false;
            session.complete=session.error.isEmpty(); session.upload=false; session.uploadOffset=0; session.transfer={};
            if (!session.error.isEmpty()) session.complete=false;
            return true;
        } else if (command==7) {
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
