// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2026 RoomGoblin contributors
#pragma once
#include "FeatureProviderInterface.h"

class RoomGoblinWebBridge : public QObject, public FeatureProviderInterface, public PluginInterface
{
    Q_OBJECT
    Q_PLUGIN_METADATA(IID "io.veyon.Veyon.Plugins.RoomGoblinWebBridge")
    Q_INTERFACES(PluginInterface FeatureProviderInterface)
public:
    explicit RoomGoblinWebBridge(QObject* parent = nullptr);
    Plugin::Uid uid() const override { return Plugin::Uid{"1fbe5122-142b-46d0-971b-27539c5e2c73"}; }
    QVersionNumber version() const override { return QVersionNumber(1, 0); }
    QString name() const override { return QStringLiteral("RoomGoblinWebBridge"); }
    QString description() const override { return tr("Bounded browser clipboard commands"); }
    QString vendor() const override { return QStringLiteral("RoomGoblin"); }
    QString copyright() const override { return QStringLiteral("GPL-2.0-or-later"); }
    const FeatureList& featureList() const override { return m_features; }
    bool controlFeature(Feature::Uid uid, Operation operation, const QVariantMap& arguments,
                        const ComputerControlInterfaceList& clients) override;
private:
    bool allowed() const;
    FeatureList m_features;
};
