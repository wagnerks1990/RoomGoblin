// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2026 RoomGoblin contributors
#include "RoomGoblinWebBridge.h"
#include "VeyonCore.h"
#include "VeyonConfiguration.h"
#include "VncConnection.h"
#include "VeyonServerInterface.h"
#include "VeyonWorkerInterface.h"
#include "FeatureWorkerManager.h"
#include <QClipboard>
#include <QDateTime>
#include <QGuiApplication>
#include <QMutexLocker>
#include <QMap>

namespace {
const Feature::Uid WriteUid{"d344032e-70ce-4a83-8cb8-3ebd6d6f6f39"};
const Feature::Uid KeyUid{"6c33a9b1-8b1f-4c71-bc64-85f7df210cab"};
const Feature::Uid ExchangeUid{"8fa73e19-3d66-4d59-9783-c2a1bb07e20e"};
const Feature::Uid ControlUid{"ca00ad68-1709-4abe-85e2-48dff6ccf8a2"};
const Feature::Uid BrowserControlUid{"c775285d-ea7e-4c48-a613-a73af94d4be3"};
const Feature::Uid ClipboardReadUid{"9fd323eb-5ae1-4552-8a4c-8b18837b78f7"};
QMutex clipboardContextsMutex;
QHash<QUuid, QPair<MessageContext,qint64>> clipboardContexts;
}

RoomGoblinWebBridge::RoomGoblinWebBridge(QObject* parent) : QObject(parent)
{
    m_browserSessionTimer.setInterval(500);
    connect(&m_browserSessionTimer, &QTimer::timeout, this, &RoomGoblinWebBridge::pruneBrowserSessions);
    m_browserSessionTimer.start();
    if (allowed(false))
    {
        m_features.append(Feature{QStringLiteral("RoomGoblinKeySequence"), Feature::Flag::Meta,
                                  KeyUid, {}, tr("Send key or shortcut"), {},
                                  tr("Press and release a fixed keyboard shortcut")});
        m_features.append(Feature{QStringLiteral("RoomGoblinBrowserControl"), Feature::Flag::Meta,
                                  BrowserControlUid, {}, tr("Browser remote control"), {},
                                  tr("Bounded live pointer and keyboard session")});
    }
    // Do not advertise an operation forbidden by this proxy's configuration.
    if (allowed())
    {
        m_features.append(Feature{QStringLiteral("RoomGoblinClipboardWrite"), Feature::Flag::Meta,
                                  WriteUid, {}, tr("Send clipboard text"), {},
                                  tr("Send explicitly entered text to one authenticated endpoint")});
        m_features.append(Feature{QStringLiteral("RoomGoblinClipboardRead"), Feature::Flag::Meta | Feature::Flag::AllComponents,
                                  ClipboardReadUid, {}, tr("Read clipboard text"), {},
                                  tr("Return clipboard text only after an explicit correlated request")});
    }
}

bool RoomGoblinWebBridge::allowed(bool clipboard) const
{
    if (clipboard && VeyonCore::config().clipboardSynchronizationDisabled()) return false;
    const auto disabled = VeyonCore::config().disabledFeatures();
    for (const auto& value : disabled)
    {
        const Feature::Uid uid{value};
        if (uid == ControlUid || (clipboard && (uid == WriteUid || uid == ExchangeUid || uid == ClipboardReadUid)) ||
            (!clipboard && (uid == KeyUid || uid == BrowserControlUid))) return false;
    }
    return true;
}

bool RoomGoblinWebBridge::controlFeature(Feature::Uid uid, Operation operation,
                                        const QVariantMap& arguments,
                                        const ComputerControlInterfaceList& clients)
{
    if (uid == KeyUid)
    {
        if (operation != Operation::Start || !allowed(false) || clients.size() != 1 || !clients.first())
            return false;
        // X11/RFB keysyms. No arbitrary keycodes or held-key state from HTTP.
        static const QMap<QString, QList<unsigned int>> sequences{
            {QStringLiteral("Enter"), {0xff0d}}, {QStringLiteral("Tab"), {0xff09}},
            {QStringLiteral("Escape"), {0xff1b}}, {QStringLiteral("Backspace"), {0xff08}},
            {QStringLiteral("Delete"), {0xffff}}, {QStringLiteral("Left"), {0xff51}},
            {QStringLiteral("Up"), {0xff52}}, {QStringLiteral("Right"), {0xff53}},
            {QStringLiteral("Down"), {0xff54}}, {QStringLiteral("Home"), {0xff50}},
            {QStringLiteral("End"), {0xff57}}, {QStringLiteral("PageUp"), {0xff55}},
            {QStringLiteral("PageDown"), {0xff56}}, {QStringLiteral("Ctrl+A"), {0xffe3, 0x61}},
            {QStringLiteral("Ctrl+C"), {0xffe3, 0x63}}, {QStringLiteral("Ctrl+V"), {0xffe3, 0x76}}
        };
        const auto value = arguments.value(QStringLiteral("sequence"));
        if (value.metaType().id() != QMetaType::QString) return false;
        const auto keys = sequences.value(value.toString());
        auto* connection = clients.first()->vncConnection();
        if (keys.isEmpty() || !clients.first()->hasValidFramebuffer() || !connection || !connection->isConnected())
            return false;
        for (const auto key : keys) connection->keyEvent(key, true);
        for (auto it = keys.crbegin(); it != keys.crend(); ++it) connection->keyEvent(*it, false);
        return true;
    }
    if (uid != WriteUid || operation != Operation::Start || !allowed() || clients.size() != 1)
        return false;
    const auto value = arguments.value(QStringLiteral("clipboardText"));
    if (value.metaType().id() != QMetaType::QString) return false;
    const auto text = value.toString();
    if (text.isEmpty() || text.size() > 8192 || text.toUtf8().size() > 8192 || text.contains(QChar{0}))
        return false;
    // Official v4.11.2 RemoteAccessFeaturePlugin::Argument::ClipboardText = 1.
    // Send the existing protocol message; endpoint access and disabled-feature
    // policy remain enforced by Veyon's authenticated transport/FeatureManager.
    sendFeatureMessage(FeatureMessage{ExchangeUid}.addArgument(1, text), clients);
    return true;
}

bool RoomGoblinWebBridge::handleFeatureMessage(VeyonServerInterface& server, const MessageContext& context,
                                                const FeatureMessage& message)
{
    if (message.featureUid()!=ClipboardReadUid || !allowed()) return false;
    const auto request=message.argument(0).toUuid();
    if (message.command<int>()!=1 || request.isNull() || !context.ioDevice()) return false;
    {
        QMutexLocker lock(&clipboardContextsMutex);
        const auto now=QDateTime::currentMSecsSinceEpoch();
        for (auto it=clipboardContexts.begin();it!=clipboardContexts.end();)
            if (!it.value().first.ioDevice() || it.value().second<now) it=clipboardContexts.erase(it); else ++it;
        if (clipboardContexts.size()>=4) return false;
        clipboardContexts.insert(request,{context,now+5000});
    }
    auto& manager=server.featureWorkerManager();
    if (!manager.isWorkerRunning(ClipboardReadUid) && !manager.startUnmanagedSessionWorker(ClipboardReadUid)) {
        QMutexLocker lock(&clipboardContextsMutex); clipboardContexts.remove(request); return false;
    }
    manager.sendMessageToUnmanagedSessionWorker(message);
    return true;
}

bool RoomGoblinWebBridge::handleFeatureMessageFromWorker(VeyonServerInterface& server,
                                                          const FeatureMessage& message)
{
    if (message.featureUid()!=ClipboardReadUid || !allowed() || message.command<int>()!=2) return false;
    const auto request=message.argument(0).toUuid();
    MessageContext context;
    {
        QMutexLocker lock(&clipboardContextsMutex);
        const auto it=clipboardContexts.find(request);
        if (it==clipboardContexts.end() || it.value().second<QDateTime::currentMSecsSinceEpoch()) return false;
        context=it.value().first; clipboardContexts.erase(it);
    }
    return context.ioDevice() && server.sendFeatureMessageReply(context,message);
}

bool RoomGoblinWebBridge::handleFeatureMessage(VeyonWorkerInterface& worker, const FeatureMessage& message)
{
    if (message.featureUid()!=ClipboardReadUid || !allowed() || message.command<int>()!=1) return false;
    const auto request=message.argument(0).toUuid();
    if (request.isNull()) return false;
    const auto clipboard=QGuiApplication::clipboard();
    const auto text=clipboard ? clipboard->text() : QString{};
    const auto bytes=text.toUtf8();
    const bool valid=clipboard && !text.contains(QChar{0}) && bytes.size()<=8192;
    return worker.sendFeatureMessageReply(FeatureMessage{ClipboardReadUid,static_cast<FeatureMessage::Command>(2)}
        .addArgument(0,request).addArgument(1,valid?text:QString{})
        .addArgument(2,valid?QString{}:tr("Clipboard is unavailable or exceeds 8 KiB")));
}
