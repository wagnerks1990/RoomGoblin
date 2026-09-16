/*
 * ClassroomChatMasterDialog.cpp
 *
 * Copyright (c) 2026 Veyon Community / GPL-2.0+
 */

#include "ClassroomChatMasterDialog.h"
#include "ui_ClassroomChatMasterDialog.h"

ClassroomChatMasterDialog::ClassroomChatMasterDialog( QWidget* parent ) :
	QDialog( parent ),
	ui( new Ui::ClassroomChatMasterDialog )
{
	ui->setupUi( this );
	ui->inputEdit->setMaxLength(2000);
	ui->logEdit->setMaximumBlockCount(500);
	setModal( false );

	connect( ui->sendButton, &QPushButton::clicked, this, [this]() {
		const auto t = ui->inputEdit->text().trimmed();
		if( t.isEmpty() )
		{
			return;
		}
		ui->inputEdit->clear();
		Q_EMIT sendRequested( t );
	} );

	connect( ui->inputEdit, &QLineEdit::returnPressed, ui->sendButton, &QPushButton::click );
}

ClassroomChatMasterDialog::~ClassroomChatMasterDialog()
{
	delete ui;
}



void ClassroomChatMasterDialog::appendLine( const QString& line )
{
	ui->logEdit->appendPlainText( line );
}
