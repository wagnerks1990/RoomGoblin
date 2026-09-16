/*
 * ClassroomChatMasterDialog.h
 *
 * Copyright (c) 2026 Veyon Community / GPL-2.0+
 */

#pragma once

#include <QDialog>

namespace Ui
{
class ClassroomChatMasterDialog;
}

class ClassroomChatMasterDialog : public QDialog
{
	Q_OBJECT
public:
	explicit ClassroomChatMasterDialog( QWidget* parent = nullptr );
	~ClassroomChatMasterDialog() override;

	void appendLine( const QString& line );

Q_SIGNALS:
	void sendRequested( const QString& text );

private:
	Ui::ClassroomChatMasterDialog* ui;
};
