// SPDX-License-Identifier: GPL-2.0-or-later
#pragma once
#include "ComputerControlInterface.h"
#include <QtPlugin>
class RoomGoblinBridgeInterface
{
public:
    virtual ~RoomGoblinBridgeInterface() = default;
    virtual QVariantMap browserRequest(ComputerControlInterface::Pointer client,
                                       const QString& action, const QVariantMap& data) = 0;
};
Q_DECLARE_INTERFACE(RoomGoblinBridgeInterface, "io.roomgoblin.Veyon.BrowserBridge/1.0")
