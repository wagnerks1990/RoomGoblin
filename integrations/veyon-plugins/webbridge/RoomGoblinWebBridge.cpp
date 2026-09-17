// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2026 RoomGoblin contributors
#include "RoomGoblinWebBridge.h"
#include "VeyonCore.h"
#include "VeyonConfiguration.h"
#include "VncConnection.h"
#include <QMap>

namespace {
const Feature::Uid WriteUid{"d344032e-70ce-4a83-8cb8-3ebd6d6f6f39"};
const Feature::Uid KeyUid{"6c33a9b1-8b1f-4c71-bc64-85f7df210cab"};
const Feature::Uid ExchangeUid{"8fa73e19-3d66-4d59-9783-c2a1bb07e20e"};
const Feature::Uid ControlUid{"ca00ad68-1709-4abe-85e2-48dff6ccf8a2"};
}

RoomGoblinWebBridge::RoomGoblinWebBridge(QObject* parent) : QObject(parent)
{
    if (allowed(false))
        m_features.append(Feature{QStringLiteral("RoomGoblinKeySequence"), Feature::Flag::Meta,
                                  KeyUid, {}, tr("Send key or shortcut"), {},
                                  tr("Press and release a fixed keyboard shortcut")});
    // Do not advertise an operation forbidden by this proxy's configuration.
    if (allowed())
        m_features.append(Feature{QStringLiteral("RoomGoblinClipboardWrite"), Feature::Flag::Meta,
                                  WriteUid, {}, tr("Send clipboard text"), {},
                                  tr("Send explicitly entered text to one authenticated endpoint")});
}

bool RoomGoblinWebBridge::allowed(bool clipboard) const
{
    if (clipboard && VeyonCore::config().clipboardSynchronizationDisabled()) return false;
    const auto disabled = VeyonCore::config().disabledFeatures();
    for (const auto& value : disabled)
    {
        const Feature::Uid uid{value};
        if (uid == ControlUid || (clipboard && (uid == WriteUid || uid == ExchangeUid)) || (!clipboard && uid == KeyUid)) return false;
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
