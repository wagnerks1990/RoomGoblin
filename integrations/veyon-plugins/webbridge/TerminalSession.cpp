// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2026 RoomGoblin contributors
// Bounded Windows command sessions transported only through authenticated Veyon.
#include "RoomGoblinWebBridge.h"
#include "FeatureWorkerManager.h"
#include "VeyonServerInterface.h"
#include "VeyonWorkerInterface.h"
#include <QDateTime>
#include <QDir>
#include <QMutexLocker>
#include <QProcessEnvironment>

namespace {
const Feature::Uid TerminalFeatureUid{"b6e98d71-41ad-4d2d-8c9e-7624db7a6cb0"};
enum TerminalCommand { Start=1, Input=2, Stop=3, Started=4, Output=5, Exited=6, Failed=7 };
constexpr qint64 TerminalLifetimeMs=10*60*1000;
constexpr int MaxInputBytes=4096;
constexpr int MaxOutputChunk=16*1024;

struct TerminalContext {
    MessageContext message;
    qint64 expires{0};
    quint64 inputSequence{0};
};
QMutex terminalContextsMutex;
QHash<QUuid,TerminalContext> terminalContexts;

FeatureMessage terminalMessage(int command)
{
    return FeatureMessage{TerminalFeatureUid,static_cast<FeatureMessage::Command>(command)};
}

bool validInput(const QString& text)
{
    return !text.isEmpty() && !text.contains(QChar{0}) && text.toUtf8().size()<=MaxInputBytes;
}
}

bool RoomGoblinWebBridge::handleTerminalServer(VeyonServerInterface& server,
                                                const MessageContext& context,
                                                const FeatureMessage& message)
{
    if (!terminalAllowed() || !context.ioDevice()) return false;
    const auto id=message.argument(0).toUuid();
    const int command=message.command<int>();
    if (id.isNull() || command<Start || command>Stop) return false;
    const auto now=QDateTime::currentMSecsSinceEpoch();
    {
        QMutexLocker lock(&terminalContextsMutex);
        for (auto it=terminalContexts.begin();it!=terminalContexts.end();) {
            if (!it->message.ioDevice() || it->expires<now) it=terminalContexts.erase(it);
            else ++it;
        }
        if (command==Start) {
            const auto shell=message.argument(1).toString();
            if ((shell!=QStringLiteral("cmd") && shell!=QStringLiteral("powershell")) ||
                (!terminalContexts.isEmpty() && !terminalContexts.contains(id))) return false;
            if (terminalContexts.contains(id) ||
                (!server.featureWorkerManager().isWorkerRunning(TerminalFeatureUid) &&
                 !server.featureWorkerManager().startUnmanagedSessionWorker(TerminalFeatureUid))) return false;
            terminalContexts.insert(id,{context,now+TerminalLifetimeMs,0});
        } else {
            auto it=terminalContexts.find(id);
            if (it==terminalContexts.end() || it->message.ioDevice()!=context.ioDevice()) return false;
            if (command==Input) {
                bool sequenceOk=false;
                const auto sequence=message.argument(3).toULongLong(&sequenceOk);
                if (!sequenceOk || sequence<=it->inputSequence || !validInput(message.argument(2).toString())) return false;
                it->inputSequence=sequence;
            }
            it->expires=now+TerminalLifetimeMs;
        }
    }
    server.featureWorkerManager().sendMessageToUnmanagedSessionWorker(message);
    return true;
}

bool RoomGoblinWebBridge::handleTerminalWorkerReply(VeyonServerInterface& server,
                                                     const FeatureMessage& message)
{
    if (!terminalAllowed()) return false;
    const auto id=message.argument(0).toUuid();
    const int command=message.command<int>();
    if (id.isNull() || command<Started || command>Failed) return false;
    MessageContext context;
    {
        QMutexLocker lock(&terminalContextsMutex);
        auto it=terminalContexts.find(id);
        if (it==terminalContexts.end() || it->expires<QDateTime::currentMSecsSinceEpoch()) return false;
        context=it->message;
        if (command==Exited || command==Failed) terminalContexts.erase(it);
    }
    return context.ioDevice() && server.sendFeatureMessageReply(context,message);
}

void RoomGoblinWebBridge::sendTerminalOutput()
{
    if (!m_terminalWorker || m_terminalContext.isNull()) return;
    QByteArray bytes=m_terminalProcess.readAllStandardOutput();
    bytes.append(m_terminalProcess.readAllStandardError());
    while (!bytes.isEmpty()) {
        const auto part=bytes.left(MaxOutputChunk); bytes.remove(0,part.size());
        m_terminalWorker->sendFeatureMessageReply(
            terminalMessage(Output).addArgument(0,m_terminalContext)
                .addArgument(2,QString::fromLocal8Bit(part)));
    }
}

void RoomGoblinWebBridge::stopTerminalProcess(const QString& reason, bool notify)
{
    if (m_terminalProcess.state()!=QProcess::NotRunning) {
        m_terminalProcess.terminate();
        if (!m_terminalProcess.waitForFinished(1000)) m_terminalProcess.kill();
    }
    if (notify && m_terminalWorker && !m_terminalContext.isNull())
        m_terminalWorker->sendFeatureMessageReply(
            terminalMessage(Failed).addArgument(0,m_terminalContext).addArgument(5,reason.left(500)));
    m_terminalTimer.stop(); m_terminalContext={}; m_terminalWorker=nullptr;
}

bool RoomGoblinWebBridge::handleTerminalWorker(VeyonWorkerInterface& worker,
                                                const FeatureMessage& message)
{
    if (!terminalAllowed()) return false;
    const auto id=message.argument(0).toUuid();
    const int command=message.command<int>();
    if (id.isNull() || command<Start || command>Stop) return false;
#ifndef Q_OS_WIN
    if (command==Start)
        return worker.sendFeatureMessageReply(
            terminalMessage(Failed).addArgument(0,id)
                .addArgument(5,tr("Live terminal is available only on Windows endpoints")));
    return false;
#else
    if (command==Start) {
        const auto shell=message.argument(1).toString();
        if ((shell!=QStringLiteral("cmd") && shell!=QStringLiteral("powershell")) ||
            m_terminalProcess.state()!=QProcess::NotRunning) return false;
        m_terminalWorker=&worker; m_terminalContext=id;
        m_terminalProcess.setProcessChannelMode(QProcess::SeparateChannels);
        m_terminalProcess.setProcessEnvironment(QProcessEnvironment::systemEnvironment());
        m_terminalProcess.setWorkingDirectory(QDir::homePath());
        if (shell==QStringLiteral("cmd")) {
            m_terminalProcess.setProgram(QStringLiteral("cmd.exe"));
            m_terminalProcess.setArguments({QStringLiteral("/Q"),QStringLiteral("/D")});
        } else {
            m_terminalProcess.setProgram(QStringLiteral("powershell.exe"));
            m_terminalProcess.setArguments({QStringLiteral("-NoLogo"),QStringLiteral("-NoProfile"),
                                            QStringLiteral("-NoExit"),QStringLiteral("-Command"),QStringLiteral("-")});
        }
        m_terminalProcess.start(QIODevice::ReadWrite);
        if (!m_terminalProcess.waitForStarted(3000)) {
            const auto error=m_terminalProcess.errorString();
            m_terminalContext={}; m_terminalWorker=nullptr;
            return worker.sendFeatureMessageReply(
                terminalMessage(Failed).addArgument(0,id)
                    .addArgument(5,tr("Could not start shell: %1").arg(error).left(500)));
        }
        m_terminalTimer.start(TerminalLifetimeMs);
        return worker.sendFeatureMessageReply(terminalMessage(Started).addArgument(0,id));
    }
    if (id!=m_terminalContext || !m_terminalWorker || m_terminalProcess.state()==QProcess::NotRunning) return false;
    if (command==Stop) { stopTerminalProcess(QString{},false); return true; }
    const auto text=message.argument(2).toString();
    if (!validInput(text)) return false;
    const auto bytes=text.toUtf8();
    return m_terminalProcess.write(bytes)==bytes.size();
#endif
}

bool RoomGoblinWebBridge::handleTerminalMaster(ComputerControlInterface::Pointer client,
                                                const FeatureMessage& message)
{
    if (!client || message.featureUid()!=TerminalFeatureUid) return false;
    const auto id=message.argument(0).toUuid();
    const int command=message.command<int>();
    if (id.isNull() || command<Started || command>Failed) return false;
    QMutexLocker lock(&m_browserMutex);
    for (auto& session : m_browserSessions) {
        if (session.kind!=QStringLiteral("terminal") || session.client.toStrongRef()!=client || session.context!=id) continue;
        if (command==Started) {
            session.pending=false; session.terminalReady=true; session.error.clear();
        } else if (command==Output) {
            const auto text=message.argument(2).toString();
            if (text.contains(QChar{0})) return true;
            session.terminalOutput.append(text.left(32768));
            if (session.terminalOutput.size()>128*1024) {
                const auto remove=session.terminalOutput.size()-128*1024;
                session.terminalOutput.remove(0,remove); session.terminalBase+=remove;
            }
        } else if (command==Exited) {
            session.pending=false; session.terminalReady=false; session.terminalExited=true;
        } else {
            session.pending=false; session.terminalReady=false; session.terminalExited=true;
            session.error=message.argument(5).toString().left(500);
        }
        return true;
    }
    return false;
}
