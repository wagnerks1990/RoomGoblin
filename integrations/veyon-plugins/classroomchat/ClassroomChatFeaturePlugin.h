/*
 * ClassroomChatFeaturePlugin.h - classroom chat (master + worker)
 *
 * Copyright (c) 2026 Veyon Community / GPL-2.0+
 */

#pragma once

#include <QPointer>
#include "Feature.h"
#include "FeatureProviderInterface.h"
#include "PluginInterface.h"

class ClassroomChatMasterDialog;
class VeyonMasterInterface;

class ClassroomChatFeaturePlugin : public QObject, public FeatureProviderInterface, public PluginInterface
{
	Q_OBJECT
	Q_PLUGIN_METADATA(IID "io.veyon.Veyon.Plugins.ClassroomChat")
	Q_INTERFACES(PluginInterface FeatureProviderInterface)
public:
	enum class Argument
	{
		ContextId,
		Text
	};
	Q_ENUM(Argument)

	enum class ChatCommand : qint32
	{
		StartSession = 10,
		TeacherLine = 11,
		StudentLine = 12,
		StopSession = 13
	};
	Q_ENUM(ChatCommand)

	explicit ClassroomChatFeaturePlugin( QObject* parent = nullptr );
	~ClassroomChatFeaturePlugin() override;

	Plugin::Uid uid() const override
	{
		return Plugin::Uid{ QStringLiteral( "7f8e9d0c-1b2a-4356-9876-543210fedcba" ) };
	}

	QVersionNumber version() const override
	{
		return QVersionNumber( 1, 0 );
	}

	QString name() const override
	{
		return QStringLiteral( "ClassroomChat" );
	}

	QString description() const override
	{
		return tr( "Two-way classroom chat with selected computers" );
	}

	QString vendor() const override
	{
		return QStringLiteral( "Veyon Community" );
	}

	QString copyright() const override
	{
		return QStringLiteral( "GPL-2.0+" );
	}

	const FeatureList& featureList() const override;

	bool controlFeature( Feature::Uid featureUid, Operation operation, const QVariantMap& arguments,
						 const ComputerControlInterfaceList& computerControlInterfaces ) override;

	bool startFeature( VeyonMasterInterface& master, const Feature& feature,
					   const ComputerControlInterfaceList& computerControlInterfaces ) override;

	bool stopFeature( VeyonMasterInterface& master, const Feature& feature,
					  const ComputerControlInterfaceList& computerControlInterfaces ) override;

	bool handleFeatureMessage( ComputerControlInterface::Pointer computerControlInterface,
							   const FeatureMessage& message ) override;

	bool handleFeatureMessage( VeyonServerInterface& server, const MessageContext& messageContext,
							   const FeatureMessage& message ) override;

	bool handleFeatureMessageFromWorker( VeyonServerInterface& server, const FeatureMessage& message ) override;

	bool handleFeatureMessage( VeyonWorkerInterface& worker, const FeatureMessage& message ) override;

private:
	void sendStopToAll();
	void sendTeacherLine( const QString& text );
	void beginSessions( const ComputerControlInterfaceList& list );

	const Feature m_chatFeature;
	const FeatureList m_features;

	QPointer<ClassroomChatMasterDialog> m_masterDialog;
	ComputerControlInterfaceList m_clients;
	QHash<ComputerControlInterface*, QUuid> m_contextByClient;
};
