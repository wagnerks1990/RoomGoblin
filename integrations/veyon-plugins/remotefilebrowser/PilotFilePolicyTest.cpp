// SPDX-License-Identifier: GPL-2.0-or-later
#include "PilotFilePolicy.h"
#include <QCoreApplication>
#include <QTemporaryDir>
#include <QFile>
#include <cassert>
int main(int argc, char** argv) {
    QCoreApplication app(argc,argv);
    QTemporaryDir temp;
    assert(temp.isValid());
    QDir dir(temp.path());
    assert(dir.mkdir("pilot")); assert(dir.mkdir("pilot-other"));
    const auto root=dir.filePath("pilot"), inside=dir.filePath("pilot/work.txt"), outside=dir.filePath("pilot-other/work.txt");
    for(const auto& name: {inside,outside}) { QFile file(name); assert(file.open(QFile::WriteOnly)); file.write("test"); }
    using RoomGoblinPilot::allowedPilotPath;
    assert(allowedPilotPath(root,root)); assert(allowedPilotPath(inside,root));
    assert(!allowedPilotPath(outside,root));
    assert(!allowedPilotPath(root+"/../pilot-other/work.txt",root));
    assert(!allowedPilotPath(root+"/missing",root));
    assert(!allowedPilotPath("relative.txt",root));
    const auto link=root+"/link";
    assert(QFile::link(outside,link)); assert(!allowedPilotPath(link,root));
    return 0;
}
