// SPDX-License-Identifier: GPL-2.0-or-later
// RoomGoblin pilot restrictions; not an adversarial filesystem sandbox.
#pragma once
#include <QDir>
#include <QFileInfo>
namespace RoomGoblinPilot {
constexpr qint64 MaxPilotFileSize = 50 * 1024 * 1024;
inline QString pilotRoot() { return QDir::home().filePath(QStringLiteral("RoomGoblin-Pilot")); }
inline bool allowedPilotPath(const QString& path, const QString& rootPath=pilotRoot()) {
	if(path.size()>4096 || !QDir::isAbsolutePath(path)) return false;
	const QFileInfo root(rootPath), file(path);
	if(!root.isDir() || root.isSymLink() || file.isSymLink()) return false;
	const auto base=root.canonicalFilePath(), target=file.canonicalFilePath();
	return !base.isEmpty() && !target.isEmpty() &&
		(target==base || target.startsWith(base + QLatin1Char('/')));
}
}
