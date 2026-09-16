// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2026 RoomGoblin contributors
#include "RoomGoblinWebBridge.h"
#include "VeyonCore.h"
#include "VeyonConfiguration.h"

namespace {
const Feature::Uid WriteUid{"d344032e-70ce-4a83-8cb8-3ebd6d6f6f39"};
const Feature::Uid ExchangeUid{"8fa73e19-3d66-4d59-9783-c2a1bb07e20e"};
const Feature::Uid ControlUid{"ca00ad68-1709-4abe-85e2-48dff6ccf8a2"};
}

RoomGoblinWebBridge::RoomGoblinWebBridge(QObject* parent) : QObject(parent)
{
    // Do not advertise an operation forbidden by this proxy's configuration.
    if (allowed())
        m_features.append(Feature{QStringLiteral("RoomGoblinClipboardWrite"), Feature::Flag::Meta,
                                  WriteUid, {}, tr("Send clipboard text"), {},
                                  tr("Send explicitly entered text to one authenticated endpoint")});
}

bool RoomGoblinWebBridge::allowed() const
{
    if (VeyonCore::config().clipboardSynchronizationDisabled()) return false;
    const auto disabled = VeyonCore::config().disabledFeatures();
    for (const auto& value : disabled)
    {
        const Feature::Uid uid{value};
        if (uid == WriteUid || uid == ExchangeUid || uid == ControlUid) return false;
    }
    return true;
}

bool RoomGoblinWebBridge::controlFeature(Feature::Uid uid, Operation operation,
                                        const QVariantMap& arguments,
                                        const ComputerControlInterfaceList& clients)
{
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
