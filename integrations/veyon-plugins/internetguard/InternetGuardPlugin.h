// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2025-2026 Raffaele Mele and RoomGoblin contributors.
// Derived from lellomele/veyon-internet-guard for the RoomGoblin pilot.
#pragma once

#include <QTimer>

#include "FeatureProviderInterface.h"
#include "PluginInterface.h"

class InternetGuardPlugin final : public QObject,
	public FeatureProviderInterface,
	public PluginInterface
{
	Q_OBJECT
	Q_PLUGIN_METADATA(IID "io.veyon.Veyon.Plugins.InternetGuard")
	Q_INTERFACES(PluginInterface FeatureProviderInterface)
public:
	explicit InternetGuardPlugin(QObject* parent = nullptr);
	~InternetGuardPlugin() override = default;

	Plugin::Uid uid() const override
	{
		return Plugin::Uid{QStringLiteral("a4b3c2d1-e5f6-7890-abcd-ef1234567890")};
	}
	QVersionNumber version() const override { return QVersionNumber(1, 4); }
	QString name() const override { return QStringLiteral("InternetGuard"); }
	QString description() const override
	{
		return tr("Temporarily block common Internet protocols on Windows pilot computers");
	}
	QString vendor() const override { return QStringLiteral("Veyon Community / RoomGoblin pilot"); }
	QString copyright() const override { return QStringLiteral("GPL-2.0-only"); }
	const FeatureList& featureList() const override { return m_features; }

	bool controlFeature(Feature::Uid featureUid, Operation operation,
		const QVariantMap& arguments,
		const ComputerControlInterfaceList& computerControlInterfaces) override;
	bool handleFeatureMessage(VeyonServerInterface& server,
		const MessageContext& context, const FeatureMessage& message) override;

private:
	enum class Command : qint32 { Block = 10, Allow = 11 };
	Q_ENUM(Command)

	bool isOwnFeature(Feature::Uid featureUid) const;
	void blockInternet();
	void allowInternet();

	const Feature m_toggleFeature;
	const Feature m_blockFeature;
	const Feature m_allowFeature;
	const FeatureList m_features;
	QTimer m_autoReleaseTimer;
};
