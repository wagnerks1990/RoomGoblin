// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2025-2026 Raffaele Mele and RoomGoblin contributors.
// Derived from lellomele/veyon-internet-guard for the RoomGoblin pilot.
#include "InternetGuardPlugin.h"

#include "WindowsFirewall.h"

namespace
{
constexpr auto AutoReleaseMilliseconds = 15 * 60 * 1000;
const Feature::Uid ToggleUid{"a4b3c2d1-e5f6-7890-abcd-ef1234567890"};
const Feature::Uid BlockUid{"b1b2c3d4-1111-2222-3333-444455556666"};
const Feature::Uid AllowUid{"c1c2c3d4-1111-2222-3333-444455556666"};
}

InternetGuardPlugin::InternetGuardPlugin(QObject* parent) :
	QObject(parent),
	m_toggleFeature(QStringLiteral("InternetGuard"),
		Feature::Flag::Mode | Feature::Flag::AllComponents, ToggleUid, {},
		tr("Block Internet (15 minute pilot)"), tr("Allow Internet"),
		tr("Temporarily block common web, DNS and proxy ports on selected Windows pilot computers"), {}),
	m_blockFeature(QStringLiteral("InternetGuardBlock"),
		Feature::Flag::Action | Feature::Flag::AllComponents, BlockUid, ToggleUid,
		tr("Block Internet for 15 minutes"), {}, {}, {}),
	m_allowFeature(QStringLiteral("InternetGuardAllow"),
		Feature::Flag::Action | Feature::Flag::AllComponents, AllowUid, ToggleUid,
		tr("Allow Internet now"), {}, {}, {}),
	m_features({m_toggleFeature, m_blockFeature, m_allowFeature})
{
	m_autoReleaseTimer.setSingleShot(true);
	connect(&m_autoReleaseTimer, &QTimer::timeout, this, &InternetGuardPlugin::allowInternet);
}

bool InternetGuardPlugin::isOwnFeature(Feature::Uid featureUid) const
{
	return featureUid == ToggleUid || featureUid == BlockUid || featureUid == AllowUid;
}

bool InternetGuardPlugin::controlFeature(Feature::Uid featureUid, Operation operation,
	const QVariantMap& arguments,
	const ComputerControlInterfaceList& computerControlInterfaces)
{
	Q_UNUSED(arguments)
	if(!isOwnFeature(featureUid))
	{
		return false;
	}

	Command command;
	if(featureUid == AllowUid || (featureUid == ToggleUid && operation == Operation::Stop))
	{
		command = Command::Allow;
	}
	else if((featureUid == BlockUid || featureUid == ToggleUid) && operation == Operation::Start)
	{
		command = Command::Block;
	}
	else
	{
		return false;
	}

	sendFeatureMessage(FeatureMessage{featureUid, command},
		computerControlInterfaces);
	return true;
}

bool InternetGuardPlugin::handleFeatureMessage(VeyonServerInterface& server,
	const MessageContext& context, const FeatureMessage& message)
{
	Q_UNUSED(server)
	Q_UNUSED(context)
	if(!isOwnFeature(message.featureUid()))
	{
		return false;
	}

	switch(message.command<Command>())
	{
	case Command::Block:
		blockInternet();
		return true;
	case Command::Allow:
		allowInternet();
		return true;
	}
	return false;
}

void InternetGuardPlugin::blockInternet()
{
	if(WindowsFirewall::blockInternet())
	{
		m_autoReleaseTimer.start(AutoReleaseMilliseconds);
		vInfo() << "InternetGuard pilot block applied; automatic release scheduled in 15 minutes";
	}
	else
	{
		m_autoReleaseTimer.stop();
		vWarning() << "InternetGuard pilot block was not applied";
	}
}

void InternetGuardPlugin::allowInternet()
{
	m_autoReleaseTimer.stop();
	if(WindowsFirewall::allowInternet())
	{
		vInfo() << "InternetGuard pilot rules removed";
	}
	else
	{
		vWarning() << "InternetGuard pilot rules could not be fully removed";
	}
}
