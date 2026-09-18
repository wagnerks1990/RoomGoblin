/*
 * RemoteFileBrowserPlugin.cpp - interactive remote file browsing/retrieval
 *
 * Copyright (c) 2026 VeyonFork contributors
 *
 * This file is part of VeyonFork - based on Veyon - https://veyon.io
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public
 * License as published by the Free Software Foundation; either
 * version 2 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public
 * License along with this program (see COPYING); if not, write to the
 * Free Software Foundation, Inc., 59 Temple Place - Suite 330,
 * Boston, MA 02111-1307, USA.
 *
 */

#include <QDateTime>
#include <QDir>
#include <QDirIterator>
#include <QFileInfo>
#include <QMessageBox>
#include <QStorageInfo>

#include "ComputerControlInterface.h"
#include "FeatureWorkerManager.h"
#include "RemoteFileBrowserDialog.h"
#include "RemoteFileBrowserPlugin.h"
#include "VeyonCore.h"
#include "VeyonMasterInterface.h"
#include "VeyonServerInterface.h"
#include "VeyonWorkerInterface.h"

#include "PilotFilePolicy.h"
using namespace RoomGoblinPilot;


QString RemoteFileBrowserPlugin::featureIconUrl()
{
	// pick the dark variant so the feature is dark-mode aware from day one
	return VeyonCore::useDarkMode()
			? QStringLiteral(":/remotefilebrowser/remote-file-browser-dark.png")
			: QStringLiteral(":/remotefilebrowser/remote-file-browser.png");
}



RemoteFileBrowserPlugin::RemoteFileBrowserPlugin( QObject* parent ) :
	QObject( parent ),
	m_feature( QStringLiteral("RemoteFileBrowser"),
			   Feature::Flag::Action | Feature::Flag::AllComponents,
			   Feature::Uid("b1d9f27a-4c86-4f1e-9a3d-6e0c85f7b214"),
			   Feature::Uid(),
			   tr( "File browser" ), {},
			   tr( "Click this button to browse the files on a remote computer and retrieve them." ),
			   featureIconUrl() ),
	m_features( { m_feature } )
{
	m_downloadTimer.setInterval( 25 );
	connect( &m_downloadTimer, &QTimer::timeout, this, &RemoteFileBrowserPlugin::pumpDownload );
}



bool RemoteFileBrowserPlugin::controlFeature( Feature::Uid featureUid, Operation operation,
											  const QVariantMap& arguments,
											  const ComputerControlInterfaceList& computerControlInterfaces )
{
	Q_UNUSED(featureUid)
	Q_UNUSED(operation)
	Q_UNUSED(arguments)
	Q_UNUSED(computerControlInterfaces)

	// the file browser is an interactive, GUI-driven feature - there is no meaningful
	// headless/CLI control for it yet
	return false;
}



bool RemoteFileBrowserPlugin::startFeature( VeyonMasterInterface& master, const Feature& feature,
											const ComputerControlInterfaceList& computerControlInterfaces )
{
	if( feature != m_feature )
	{
		return false;
	}

	if( computerControlInterfaces.isEmpty() )
	{
		QMessageBox::information( master.mainWindow(), tr( "File browser" ),
								  tr( "Please select a computer to browse." ) );
		return true;
	}

	if( computerControlInterfaces.count() > 1 )
	{
		QMessageBox::information( master.mainWindow(), tr( "File browser" ),
								  tr( "Multiple computers are selected. The file browser will open "
									  "for the first one." ) );
	}

	if( m_dialog )
	{
		m_dialog->raise();
		m_dialog->activateWindow();
		return true;
	}

	auto dialog = new RemoteFileBrowserDialog( this, computerControlInterfaces.first(), master.mainWindow() );
	m_dialog = dialog;
	connect( dialog, &QDialog::finished, dialog, &QDialog::deleteLater );
	dialog->open();

	return true;
}



// ---------------------------------------------------------------------------
// master side: replies coming back from a client
// ---------------------------------------------------------------------------
bool RemoteFileBrowserPlugin::handleFeatureMessage( ComputerControlInterface::Pointer computerControlInterface,
													const FeatureMessage& message )
{

	if( message.featureUid() != m_feature.uid() )
	{
		return false;
	}

	if( m_dialog.isNull() || m_dialog->computer() != computerControlInterface )
	{
		return true;
	}

	switch( message.command<FeatureCommand>() )
	{
	case FeatureCommand::DriveList:
		m_dialog->setDrives( message.argument( Argument::Entries ).toList() );
		break;

	case FeatureCommand::DirectoryListing:
		m_dialog->setDirectoryListing( message.argument( Argument::Path ).toString(),
									   message.argument( Argument::Entries ).toList(),
									   message.argument( Argument::Error ).toString() );
		break;

	case FeatureCommand::DownloadInfo:
		m_dialog->downloadStarted( message.argument( Argument::TransferId ).toUuid(),
								   message.argument( Argument::FileSize ).toLongLong(),
								   message.argument( Argument::Error ).toString() );
		break;

	case FeatureCommand::DownloadDataChunk:
		m_dialog->downloadDataReceived( message.argument( Argument::TransferId ).toUuid(),
										message.argument( Argument::DataChunk ).toByteArray() );
		break;

	case FeatureCommand::DownloadFinished:
		m_dialog->downloadFinished( message.argument( Argument::TransferId ).toUuid() );
		break;

	default:
		break;
	}

	return true;
}



// ---------------------------------------------------------------------------
// server side (student PC): remember the caller and hand work to the session worker
// ---------------------------------------------------------------------------
bool RemoteFileBrowserPlugin::handleFeatureMessage( VeyonServerInterface& server,
													const MessageContext& messageContext,
													const FeatureMessage& message )
{
	if( message.featureUid() != m_feature.uid() )
	{
		return false;
	}

	const auto command=message.command<FeatureCommand>();
	const auto requestId=message.argument(Argument::RequestId).toUuid();
	const auto transferId=message.argument(Argument::TransferId).toUuid();
	if(command!=FeatureCommand::GetDrives && command!=FeatureCommand::ListDirectory &&
	   command!=FeatureCommand::StartDownload && command!=FeatureCommand::CancelDownload &&
	   command!=FeatureCommand::StopWorker && command!=FeatureCommand::StartUpload &&
	   command!=FeatureCommand::UploadDataChunk && command!=FeatureCommand::FinishUpload &&
	   command!=FeatureCommand::CancelUpload) return false;
	if((command==FeatureCommand::GetDrives || command==FeatureCommand::ListDirectory) && requestId.isNull()) return false;
	if((command==FeatureCommand::StartDownload || command==FeatureCommand::CancelDownload ||
		command==FeatureCommand::StartUpload || command==FeatureCommand::UploadDataChunk ||
		command==FeatureCommand::FinishUpload || command==FeatureCommand::CancelUpload) && transferId.isNull()) return false;
	// Pilot is pinned to one active authenticated teacher. Validate before
	// assigning ownership, and clear generations before a replacement caller.
	if(!messageContext.ioDevice()) return false;
	if(m_callerAssigned && !m_masterContext.ioDevice()) {
		m_requestContexts.clear(); m_transferContexts.clear(); m_masterContext=MessageContext{}; m_callerAssigned=false;
	}
	if(m_callerAssigned && m_masterContext.ioDevice()!=messageContext.ioDevice()) return false;
	m_callerAssigned=true;
	m_masterContext=messageContext;
	if((command==FeatureCommand::GetDrives || command==FeatureCommand::ListDirectory) && m_requestContexts.size()>=16) return false;
	// The session worker owns one QFile. Never replace an in-flight generation
	// without a terminal reply to its authenticated caller.
	if((command==FeatureCommand::StartDownload || command==FeatureCommand::StartUpload) && !m_transferContexts.isEmpty()) return false;
	if(command==FeatureCommand::GetDrives || command==FeatureCommand::ListDirectory) m_requestContexts.insert(requestId,messageContext);
	if(command==FeatureCommand::StartDownload || command==FeatureCommand::StartUpload) m_transferContexts.insert(transferId,messageContext);
	if(command==FeatureCommand::CancelDownload || command==FeatureCommand::CancelUpload) m_transferContexts.remove(transferId);
	if(command==FeatureCommand::StopWorker) {
		server.featureWorkerManager().stopWorker(m_feature.uid());
		m_requestContexts.clear();
		m_transferContexts.clear();
		m_masterContext=MessageContext{};
		m_callerAssigned=false;
		return true;
	}

	// the worker runs in the user's session and therefore sees the user's files
	server.featureWorkerManager().sendMessageToUnmanagedSessionWorker( message );

	return true;
}



bool RemoteFileBrowserPlugin::handleFeatureMessageFromWorker( VeyonServerInterface& server,
															  const FeatureMessage& message )
{
	if( message.featureUid() != m_feature.uid() )
	{
		return false;
	}

	MessageContext context;
	const auto command=message.command<FeatureCommand>();
	if(command==FeatureCommand::DriveList || command==FeatureCommand::DirectoryListing) {
		const auto id=message.argument(Argument::RequestId).toUuid();
		context=m_requestContexts.take(id);
	} else if(command==FeatureCommand::DownloadInfo || command==FeatureCommand::DownloadDataChunk ||
		command==FeatureCommand::DownloadFinished || command==FeatureCommand::UploadFinished) {
		const auto id=message.argument(Argument::TransferId).toUuid();
		context=m_transferContexts.value(id);
		if(command==FeatureCommand::DownloadFinished || command==FeatureCommand::UploadFinished ||
		   (command==FeatureCommand::DownloadInfo && !message.argument(Argument::Error).toString().isEmpty()))
			m_transferContexts.remove(id);
	} else return false;
	// Every reply is routed by its unguessable request/transfer generation. A
	// late reply from a closed teacher has no mapping and cannot reach a new one.
	return context.ioDevice() && server.sendFeatureMessageReply( context, message );
}



// ---------------------------------------------------------------------------
// worker side (user session): the actual filesystem access
// ---------------------------------------------------------------------------
bool RemoteFileBrowserPlugin::handleFeatureMessage( VeyonWorkerInterface& worker,
													const FeatureMessage& message )
{
	if( message.featureUid() != m_feature.uid() )
	{
		return false;
	}

	m_worker = &worker;

	switch( message.command<FeatureCommand>() )
	{
	case FeatureCommand::GetDrives:
		return workerGetDrives( worker, message );

	case FeatureCommand::ListDirectory:
		return workerListDirectory( worker, message );

	case FeatureCommand::StartDownload:
		return workerStartDownload( worker, message );

	case FeatureCommand::StartUpload:
		return workerStartUpload( worker, message );

	case FeatureCommand::UploadDataChunk:
		return workerUploadChunk( worker, message );

	case FeatureCommand::FinishUpload:
		return workerFinishUpload( worker, message );

	case FeatureCommand::CancelUpload:
		workerCancelUpload();
		return true;

	case FeatureCommand::CancelDownload:
	case FeatureCommand::StopWorker:
		workerCancelDownload();
		workerCancelUpload();
		return true;

	default:
		break;
	}

	return true;
}



bool RemoteFileBrowserPlugin::workerGetDrives( VeyonWorkerInterface& worker, const FeatureMessage& message )
{
	QVariantList entries;

	if(allowedPilotPath(pilotRoot())) {
		QVariantMap entry;
		entry[entryKeyName()]=pilotRoot();
		entry[entryKeyIsDir()]=true;
		entry[entryKeySize()]=0;
		entries.append(entry);
	}

	return worker.sendFeatureMessageReply(
				FeatureMessage( m_feature.uid(), FeatureCommand::DriveList )
                    .addArgument( Argument::RequestId, message.argument( Argument::RequestId ) )
					.addArgument( Argument::Entries, entries ) );
}



bool RemoteFileBrowserPlugin::workerListDirectory( VeyonWorkerInterface& worker,
												   const FeatureMessage& message )
{
	const auto path = message.argument( Argument::Path ).toString();

	QVariantList entries;
	QString error;

	const QDir dir( path );
	if( !allowedPilotPath(path) || dir.exists() == false )
	{
		error = tr( "Directory does not exist or is not accessible." );
	}
	else
	{
		QDirIterator iterator(path, QDir::AllEntries | QDir::NoDotAndDotDot | QDir::NoSymLinks);
		while(iterator.hasNext())
		{
			if(entries.size()>=1000) { error=tr("Directory exceeds pilot limit of 1000 items."); entries.clear(); break; }
			iterator.next();
			const auto info=iterator.fileInfo();
			if(!allowedPilotPath(info.absoluteFilePath())) continue;
			QVariantMap entry;
			entry[entryKeyName()] = info.fileName();
			entry[entryKeyIsDir()] = info.isDir();
			entry[entryKeySize()] = static_cast<qlonglong>( info.isDir() ? 0 : info.size() );
			entry[entryKeyModified()] = info.lastModified().toMSecsSinceEpoch();
			entries.append( entry );
		}
	}

	return worker.sendFeatureMessageReply(
				FeatureMessage( m_feature.uid(), FeatureCommand::DirectoryListing )
                    .addArgument( Argument::RequestId, message.argument( Argument::RequestId ) )
					.addArgument( Argument::Path, dir.absolutePath() )
					.addArgument( Argument::Entries, entries )
					.addArgument( Argument::Error, error ) );
}



bool RemoteFileBrowserPlugin::workerStartDownload( VeyonWorkerInterface& worker,
												   const FeatureMessage& message )
{
	// only one download at a time in this version
	workerCancelDownload();

	m_downloadTransferId = message.argument( Argument::TransferId ).toUuid();
	const auto path = message.argument( Argument::Path ).toString();

	m_downloadFile.setFileName( path );

	QString error;
	qint64 size = 0;

	const QFileInfo fileInfo( path );
	if( m_downloadTransferId.isNull() || !allowedPilotPath(path) || !fileInfo.isFile() || fileInfo.size()>MaxPilotFileSize )
	{
		error = tr( "Choose a regular file up to 50 MiB inside your RoomGoblin-Pilot folder." );
	}
	else if( m_downloadFile.open( QFile::ReadOnly ) == false )
	{
		error = tr( "Could not open file: %1" ).arg( m_downloadFile.errorString() );
	}
	else
	{
		size = m_downloadFile.size();
		if(size>MaxPilotFileSize) { error=tr("File exceeds pilot limit."); m_downloadFile.close(); }
	}

	worker.sendFeatureMessageReply(
				FeatureMessage( m_feature.uid(), FeatureCommand::DownloadInfo )
					.addArgument( Argument::TransferId, m_downloadTransferId )
					.addArgument( Argument::FileName, fileInfo.fileName() )
					.addArgument( Argument::FileSize, size )
					.addArgument( Argument::Error, error ) );

	if( error.isEmpty() )
	{
		m_downloadTimer.start();
	}

	return true;
}



void RemoteFileBrowserPlugin::pumpDownload()
{
	if( m_worker == nullptr || m_downloadFile.isOpen() == false )
	{
		m_downloadTimer.stop();
		return;
	}

	if(m_downloadFile.pos()>=MaxPilotFileSize && !m_downloadFile.atEnd()) {
		m_worker->sendFeatureMessageReply(FeatureMessage(m_feature.uid(),FeatureCommand::DownloadFinished)
			.addArgument(Argument::TransferId,m_downloadTransferId)
			.addArgument(Argument::Error,tr("File grew beyond the pilot limit during transfer.")));
		workerCancelDownload(); return;
	}
	const auto data = m_downloadFile.read( qMin(ChunkSize,MaxPilotFileSize-m_downloadFile.pos()) );

	if( data.isEmpty() )
	{
		m_downloadTimer.stop();
		m_downloadFile.close();

		m_worker->sendFeatureMessageReply(
					FeatureMessage( m_feature.uid(), FeatureCommand::DownloadFinished )
						.addArgument( Argument::TransferId, m_downloadTransferId ) );
		return;
	}

	m_worker->sendFeatureMessageReply(
				FeatureMessage( m_feature.uid(), FeatureCommand::DownloadDataChunk )
					.addArgument( Argument::TransferId, m_downloadTransferId )
					.addArgument( Argument::DataChunk, data ) );
}



void RemoteFileBrowserPlugin::workerCancelDownload()
{
	m_downloadTimer.stop();

	if( m_downloadFile.isOpen() )
	{
		m_downloadFile.close();
	}
}


bool RemoteFileBrowserPlugin::workerStartUpload( VeyonWorkerInterface& worker,
											 const FeatureMessage& message )
{
	workerCancelUpload();
	m_uploadTransferId=message.argument(Argument::TransferId).toUuid();
	const auto name=message.argument(Argument::FileName).toString();
	m_uploadExpected=message.argument(Argument::FileSize).toLongLong();
	QString error;
	const auto root=pilotRoot();
	const auto inbox=QDir(root).filePath(QStringLiteral("Inbox"));
	if(m_uploadTransferId.isNull() || name.isEmpty() || name.size()>255 ||
		name==QStringLiteral(".") || name==QStringLiteral("..") ||
		name.contains(QLatin1Char('/')) || name.contains(QLatin1Char('\\')) ||
		m_uploadExpected<0 || m_uploadExpected>2*1024*1024)
	{
		error=tr("Choose one ordinary file up to 2 MiB.");
	}
	else if(!allowedPilotPath(root) || (!QDir().mkpath(inbox)) || !allowedPilotPath(inbox))
	{
		error=tr("RoomGoblin-Pilot/Inbox is unavailable.");
	}
	else
	{
		const auto destination=QDir(inbox).filePath(name);
		const QFileInfo existing(destination);
		if(existing.exists() || existing.isSymLink()) error=tr("A file with that name already exists; uploads never overwrite.");
		else { m_uploadFile.setFileName(destination); if(!m_uploadFile.open(QFile::WriteOnly)) error=tr("Could not create the destination file."); }
	}
	if(!error.isEmpty())
	{
		workerCancelUpload();
		return worker.sendFeatureMessageReply(FeatureMessage(m_feature.uid(),FeatureCommand::UploadFinished)
			.addArgument(Argument::TransferId,message.argument(Argument::TransferId)).addArgument(Argument::Error,error));
	}
	m_uploadReceived=0;
	return true;
}


bool RemoteFileBrowserPlugin::workerUploadChunk( VeyonWorkerInterface& worker,
											 const FeatureMessage& message )
{
	const auto id=message.argument(Argument::TransferId).toUuid();
	const auto offset=message.argument(Argument::Offset).toLongLong();
	const auto bytes=message.argument(Argument::DataChunk).toByteArray();
	if(id!=m_uploadTransferId || !m_uploadFile.isOpen() || offset!=m_uploadReceived ||
		bytes.isEmpty() || bytes.size()>ChunkSize || m_uploadReceived+bytes.size()>m_uploadExpected ||
		m_uploadFile.write(bytes)!=bytes.size())
	{
		workerCancelUpload();
		return worker.sendFeatureMessageReply(FeatureMessage(m_feature.uid(),FeatureCommand::UploadFinished)
			.addArgument(Argument::TransferId,id).addArgument(Argument::Error,tr("Upload chunk rejected; partial file discarded.")));
	}
	m_uploadReceived+=bytes.size();
	return true;
}


bool RemoteFileBrowserPlugin::workerFinishUpload( VeyonWorkerInterface& worker,
											  const FeatureMessage& message )
{
	const auto id=message.argument(Argument::TransferId).toUuid();
	QString error;
	if(id!=m_uploadTransferId || !m_uploadFile.isOpen() || m_uploadReceived!=m_uploadExpected)
		error=tr("Upload length mismatch; partial file discarded.");
	else if(QFileInfo::exists(m_uploadFile.fileName()))
		error=tr("A file with that name appeared during upload; partial file discarded.");
	else if(!m_uploadFile.commit()) error=tr("Could not commit uploaded file atomically.");
	if(!error.isEmpty()) workerCancelUpload();
	else { m_uploadTransferId={}; m_uploadExpected=0; m_uploadReceived=0; }
	return worker.sendFeatureMessageReply(FeatureMessage(m_feature.uid(),FeatureCommand::UploadFinished)
		.addArgument(Argument::TransferId,id).addArgument(Argument::Error,error));
}


void RemoteFileBrowserPlugin::workerCancelUpload()
{
	if(m_uploadFile.isOpen()) m_uploadFile.cancelWriting();
	m_uploadTransferId={}; m_uploadExpected=0; m_uploadReceived=0;
}



// ---------------------------------------------------------------------------
// master-side senders used by the dialog
// ---------------------------------------------------------------------------
void RemoteFileBrowserPlugin::requestDrives( const ComputerControlInterface::Pointer& computer )
{
	computer->sendFeatureMessage( FeatureMessage( m_feature.uid(), FeatureCommand::GetDrives )
								  .addArgument( Argument::RequestId, QUuid::createUuid() ) );
}



void RemoteFileBrowserPlugin::requestDirectory( const ComputerControlInterface::Pointer& computer,
												const QString& path )
{
	computer->sendFeatureMessage( FeatureMessage( m_feature.uid(), FeatureCommand::ListDirectory )
								  .addArgument( Argument::RequestId, QUuid::createUuid() )
								  .addArgument( Argument::Path, path ) );
}



void RemoteFileBrowserPlugin::startDownload( const ComputerControlInterface::Pointer& computer,
											 QUuid transferId, const QString& remotePath )
{
	computer->sendFeatureMessage( FeatureMessage( m_feature.uid(), FeatureCommand::StartDownload )
								  .addArgument( Argument::TransferId, transferId )
								  .addArgument( Argument::Path, remotePath ) );
}



void RemoteFileBrowserPlugin::cancelDownload( const ComputerControlInterface::Pointer& computer,
											  QUuid transferId )
{
	computer->sendFeatureMessage( FeatureMessage( m_feature.uid(), FeatureCommand::CancelDownload )
								  .addArgument( Argument::TransferId, transferId ) );
}



void RemoteFileBrowserPlugin::stopWorker( const ComputerControlInterface::Pointer& computer )
{
	computer->sendFeatureMessage( FeatureMessage( m_feature.uid(), FeatureCommand::StopWorker ) );
}
