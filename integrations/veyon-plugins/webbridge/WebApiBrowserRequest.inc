// SPDX-License-Identifier: GPL-2.0-or-later
// Compiled into the pinned WebAPI controller by the pilot preparer.
#include "PluginManager.h"
#include "../webbridge/RoomGoblinBridgeInterface.h"
WebApiController::Response WebApiController::roomGoblinRequest(const Request& request, const QString& action)
{
    const auto checked=checkConnection(request);
    if (checked.error!=Error::NoError) return checked;
    const auto connection=lookupConnection(request);
    if (!connection) return Error::InvalidConnection;
    static const QStringList actions{QStringLiteral("capabilities"),QStringLiteral("open"),QStringLiteral("close"),
        QStringLiteral("state"),QStringLiteral("send"),QStringLiteral("roots"),QStringLiteral("list"),
        QStringLiteral("download"),QStringLiteral("chunk")};
    if (!actions.contains(action)) return Error::InvalidData;
    return runInWorkerThread<Response>([&]() -> Response {
        for (auto* object : VeyonCore::pluginManager().pluginObjects())
            if (auto* bridge=qobject_cast<RoomGoblinBridgeInterface*>(object))
                return bridge->browserRequest(connection->controlInterface(),action,request.data);
        return Error::InvalidFeature;
    });
}
