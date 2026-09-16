/*
 * ClassroomChatFeaturePlugin.cpp
 *
 * Copyright (c) 2026 Veyon Community / GPL-2.0+
 */

#include <QCoreApplication>
#include <QDialog>
#include <QHBoxLayout>
#include <QLabel>
#include <QLineEdit>
#include <QMutex>
#include <QMutexLocker>
#include <QPlainTextEdit>
#include <QPushButton>
#include <QTimer>
#include <QVBoxLayout>

#include "ClassroomChatMasterDialog.h"
#include "ClassroomChatFeaturePlugin.h"
#include "ComputerControlInterface.h"
#include "FeatureWorkerManager.h"
#include "VeyonMasterInterface.h"
#include "VeyonServerInterface.h"
#include "VeyonWorkerInterface.h"

namespace {

const Feature::Uid ClassroomChatFeatureUid{ QStringLiteral( "8a9e0f1d-2c3b-4467-a987-654321fedcba" ) };

QMutex g_chatContextMutex;
QHash<QUuid, MessageContext> g_chatContexts;

QDialog* g_studentDialog = nullptr;
QPlainTextEdit* g_studentLog = nullptr;
QLineEdit* g_studentInput = nullptr;
QUuid g_studentContext;

void appendStudentLog( const QString& line )
{
	if( g_studentLog )
	{
		g_studentLog->appendPlainText( line );
	}
}

} // namespace



ClassroomChatFeaturePlugin::ClassroomChatFeaturePlugin( QObject* parent ) :
	QObject( parent ),
	m_chatFeature( QStringLiteral( "ClassroomChat" ),
				   Feature::Flag::Action | Feature::Flag::AllComponents,
				   ClassroomChatFeatureUid,
				   Feature::Uid(),
				   tr( "Classroom chat" ),
				   {},
				   tr( "Open two-way chat with users on selected computers. "
					   "Group chat: select several PCs. Personal: select one." ),
				   QStringLiteral( ":/core/user-group-new.png" ) ),
	m_features( { m_chatFeature } )
{
}



ClassroomChatFeaturePlugin::~ClassroomChatFeaturePlugin()
{
	delete m_masterDialog;
}



const FeatureList& ClassroomChatFeaturePlugin::featureList() const
{
	return m_features;
}



bool ClassroomChatFeaturePlugin::controlFeature( Feature::Uid featureUid, Operation operation,
											   const QVariantMap& arguments,
											   const ComputerControlInterfaceList& computerControlInterfaces )
{
	Q_UNUSED( operation )
	Q_UNUSED( arguments )

	if( featureUid != m_chatFeature.uid() )
	{
		return false;
	}

	Q_UNUSED( computerControlInterfaces )
	return false; // Desktop UI only; headless success would be misleading.
}



bool ClassroomChatFeaturePlugin::startFeature( VeyonMasterInterface& master, const Feature& feature,
											   const ComputerControlInterfaceList& computerControlInterfaces )
{
	if( feature.uid() != m_chatFeature.uid() )
	{
		return false;
	}

	if( computerControlInterfaces.isEmpty() || computerControlInterfaces.size() > 32 )
	{
		return false;
	}

	if( m_masterDialog == nullptr )
	{
		m_masterDialog = new ClassroomChatMasterDialog( master.mainWindow() );
		connect( m_masterDialog, &QDialog::finished, this, [this]() {
			sendStopToAll();
			m_contextByClient.clear();
			m_clients.clear();
		} );
		connect( m_masterDialog, &ClassroomChatMasterDialog::sendRequested, this,
				 &ClassroomChatFeaturePlugin::sendTeacherLine );
	}

	sendStopToAll();
	m_contextByClient.clear();
	m_clients = computerControlInterfaces;
	m_masterDialog->show();
	m_masterDialog->raise();
	m_masterDialog->activateWindow();
	beginSessions( m_clients );

	return true;
}



bool ClassroomChatFeaturePlugin::stopFeature( VeyonMasterInterface& master, const Feature& feature,
											  const ComputerControlInterfaceList& computerControlInterfaces )
{
	Q_UNUSED( master )
	Q_UNUSED( computerControlInterfaces )

	if( feature.uid() != m_chatFeature.uid() )
	{
		return false;
	}

	if( m_masterDialog )
	{
		m_masterDialog->close();
	}

	return true;
}



void ClassroomChatFeaturePlugin::beginSessions( const ComputerControlInterfaceList& list )
{
	for( const auto& cci : list )
	{
		if( cci.isNull() )
		{
			continue;
		}

		if( m_contextByClient.contains( cci.data() ) )
		{
			continue;
		}

		const QUuid id = QUuid::createUuid();
		m_contextByClient[cci.data()] = id;

		sendFeatureMessage( FeatureMessage{m_chatFeature.uid(), ChatCommand::StartSession}
								.addArgument( Argument::ContextId, id.toString() ),
							{cci} );
	}
}



void ClassroomChatFeaturePlugin::sendTeacherLine( const QString& text )
{
	if( text.isEmpty() || text.size() > 2000 ) return;
	if( m_masterDialog )
	{
		m_masterDialog->appendLine( tr( "You: %1" ).arg( text ) );
	}

	for( const auto& cci : m_clients )
	{
		if( cci.isNull() )
		{
			continue;
		}

		const auto id = m_contextByClient.value( cci.data() );
		if( id.isNull() )
		{
			continue;
		}

		sendFeatureMessage( FeatureMessage{m_chatFeature.uid(), ChatCommand::TeacherLine}
								.addArgument( Argument::ContextId, id.toString() )
								.addArgument( Argument::Text, text ),
							{cci} );
	}
}



void ClassroomChatFeaturePlugin::sendStopToAll()
{
	for( const auto& cci : m_clients )
	{
		if( cci.isNull() )
		{
			continue;
		}

		const auto id = m_contextByClient.value( cci.data() );
		if( id.isNull() )
		{
			continue;
		}

		sendFeatureMessage( FeatureMessage{m_chatFeature.uid(), ChatCommand::StopSession}
								.addArgument( Argument::ContextId, id.toString() ),
							{cci} );
	}
}



bool ClassroomChatFeaturePlugin::handleFeatureMessage( ComputerControlInterface::Pointer computerControlInterface,
													 const FeatureMessage& message )
{
	if( message.featureUid() != m_chatFeature.uid() )
	{
		return false;
	}

	if( message.command<qint32>() != static_cast<qint32>( ChatCommand::StudentLine ) )
	{
		return false;
	}

	const auto text = message.argument( Argument::Text ).toString();
	if( computerControlInterface.isNull() || text.size() > 2000 ||
		QUuid(message.argument(Argument::ContextId).toString()) != m_contextByClient.value(computerControlInterface.data()) ||
		!m_contextByClient.contains(computerControlInterface.data()) ) return false;
	const auto host = computerControlInterface->computer().hostName();

	if( m_masterDialog )
	{
		m_masterDialog->appendLine( tr( "%1: %2" ).arg( host, text ) );
	}

	return true;
}



bool ClassroomChatFeaturePlugin::handleFeatureMessage( VeyonServerInterface& server,
													   const MessageContext& messageContext,
													   const FeatureMessage& message )
{
	if( message.featureUid() != m_chatFeature.uid() )
	{
		return false;
	}

	const auto cmd = static_cast<ChatCommand>( message.command<qint32>() );

	const QUuid id(message.argument(Argument::ContextId).toString());
	if(id.isNull() || !messageContext.ioDevice() || message.argument(Argument::Text).toString().size() > 2000) return false;
	if(cmd != ChatCommand::StartSession && cmd != ChatCommand::TeacherLine && cmd != ChatCommand::StopSession) return false;
	{
		QMutexLocker locker(&g_chatContextMutex);
		// A student has one teacher conversation. Never replace an active caller.
		for(auto it=g_chatContexts.begin(); it!=g_chatContexts.end(); )
			if(!it.value().ioDevice()) it=g_chatContexts.erase(it); else ++it;
		if(cmd == ChatCommand::StartSession) {
			if(!g_chatContexts.isEmpty()) return false;
			g_chatContexts.insert(id,messageContext);
		} else {
			if(!g_chatContexts.contains(id) || g_chatContexts.value(id).ioDevice()!=messageContext.ioDevice()) return false;
			if(cmd == ChatCommand::StopSession) g_chatContexts.remove(id);
		}
	}
	server.featureWorkerManager().sendMessageToUnmanagedSessionWorker(message);
	return true;
}



bool ClassroomChatFeaturePlugin::handleFeatureMessageFromWorker( VeyonServerInterface& server,
																 const FeatureMessage& message )
{
	if( message.featureUid() != m_chatFeature.uid() )
	{
		return false;
	}

	if( message.command<qint32>() != static_cast<qint32>( ChatCommand::StudentLine ) )
	{
		return false;
	}

	const QUuid id = QUuid( message.argument( Argument::ContextId ).toString() );

	QMutexLocker locker( &g_chatContextMutex );
	if(!g_chatContexts.contains(id) || message.argument(Argument::Text).toString().size()>2000) return false;
	const MessageContext ctx = g_chatContexts.value( id );
	locker.unlock();

	return server.sendFeatureMessageReply( ctx, message );
}



bool ClassroomChatFeaturePlugin::handleFeatureMessage( VeyonWorkerInterface& worker, const FeatureMessage& message )
{
	if( message.featureUid() != m_chatFeature.uid() )
	{
		return false;
	}

	const auto cmd = static_cast<ChatCommand>( message.command<qint32>() );

	if( cmd == ChatCommand::StartSession )
	{
		g_studentContext = QUuid( message.argument( Argument::ContextId ).toString() );

		if( g_studentDialog == nullptr )
		{
			g_studentDialog = new QDialog;
			g_studentDialog->setAttribute( Qt::WA_DeleteOnClose, false );
			g_studentDialog->setWindowTitle( tr( "Classroom chat" ) );

			auto* layout = new QVBoxLayout( g_studentDialog );
			layout->addWidget( new QLabel( tr( "You can reply to your teacher below." ) ) );
			g_studentLog = new QPlainTextEdit;
			g_studentLog->setReadOnly( true );
			g_studentLog->setMaximumBlockCount(500);
			layout->addWidget( g_studentLog );

			auto* row = new QHBoxLayout;
			g_studentInput = new QLineEdit;
			g_studentInput->setMaxLength(2000);
			auto* sendBtn = new QPushButton( tr( "Send" ) );
			row->addWidget( g_studentInput );
			row->addWidget( sendBtn );
			layout->addLayout( row );

			QObject::connect( sendBtn, &QPushButton::clicked, g_studentDialog, [&worker]() {
				const QString t = g_studentInput ? g_studentInput->text().trimmed() : QString();
				if( t.isEmpty() || g_studentContext.isNull() )
				{
					return;
				}
				g_studentInput->clear();
				appendStudentLog( QCoreApplication::translate( "ClassroomChatFeaturePlugin", "You: %1" ).arg( t ) );
				worker.sendFeatureMessageReply(
					FeatureMessage{ClassroomChatFeatureUid, ClassroomChatFeaturePlugin::ChatCommand::StudentLine}
						.addArgument( ClassroomChatFeaturePlugin::Argument::ContextId, g_studentContext.toString() )
						.addArgument( ClassroomChatFeaturePlugin::Argument::Text, t ) );
			} );

			QObject::connect( g_studentInput, &QLineEdit::returnPressed, sendBtn, &QPushButton::click );
			g_studentDialog->resize( 480, 360 );
		}

		g_studentLog->clear();
		g_studentInput->clear();
		g_studentDialog->show();
		g_studentDialog->raise();
		g_studentDialog->activateWindow();
		return true;
	}

	if( cmd == ChatCommand::TeacherLine )
	{
		if(QUuid(message.argument(Argument::ContextId).toString())!=g_studentContext || g_studentContext.isNull()) return false;
		const auto text = message.argument( Argument::Text ).toString();
		if(text.size()>2000) return false;
		appendStudentLog( tr( "Teacher: %1" ).arg( text ) );
		return true;
	}

	if( cmd == ChatCommand::StopSession )
	{
		if( g_studentDialog )
		{
			g_studentDialog->hide();
		}
		g_studentContext = {};
		if(g_studentLog) g_studentLog->clear();
		if(g_studentInput) g_studentInput->clear();
		return true;
	}

	return false;
}
