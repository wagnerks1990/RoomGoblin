// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2026 RoomGoblin contributors
#pragma once
#include "FeatureProviderInterface.h"
#include "RoomGoblinBridgeInterface.h"
#include "MessageContext.h"
#include <QMutex>
#include <QHash>
#include <QSet>
#include <QTimer>

class RoomGoblinWebBridge : public QObject, public FeatureProviderInterface, public PluginInterface, public RoomGoblinBridgeInterface
{
    Q_OBJECT
    Q_PLUGIN_METADATA(IID "io.veyon.Veyon.Plugins.RoomGoblinWebBridge")
    Q_INTERFACES(PluginInterface FeatureProviderInterface RoomGoblinBridgeInterface)
public:
    explicit RoomGoblinWebBridge(QObject* parent = nullptr);
    Plugin::Uid uid() const override { return Plugin::Uid{"1fbe5122-142b-46d0-971b-27539c5e2c73"}; }
    QVersionNumber version() const override { return QVersionNumber(1, 1); }
    QString name() const override { return QStringLiteral("RoomGoblinWebBridge"); }
    QString description() const override { return tr("Bounded browser clipboard and keyboard commands"); }
    QString vendor() const override { return QStringLiteral("RoomGoblin"); }
    QString copyright() const override { return QStringLiteral("GPL-2.0-or-later"); }
    const FeatureList& featureList() const override { return m_features; }
    bool controlFeature(Feature::Uid uid, Operation operation, const QVariantMap& arguments,
                        const ComputerControlInterfaceList& clients) override;
    QVariantMap browserRequest(ComputerControlInterface::Pointer client, const QString& action,
                               const QVariantMap& data) override;
    bool handleFeatureMessage(ComputerControlInterface::Pointer client, const FeatureMessage& message) override;
    bool handleFeatureMessage(VeyonServerInterface& server, const MessageContext& context,
                              const FeatureMessage& message) override;
    bool handleFeatureMessageFromWorker(VeyonServerInterface& server, const FeatureMessage& message) override;
    bool handleFeatureMessage(VeyonWorkerInterface& worker, const FeatureMessage& message) override;
private:
    struct BrowserSession {
        QWeakPointer<ComputerControlInterface> client;
        QString kind;
        QUuid context, request, transfer;
        qint64 expires{0}, deadline{0}, size{-1}, lastFrameMs{0}, leaseDeadline{0}, rateWindow{0};
        quint64 frameRevision{0}, leaseRevision{0}, inputSequence{0};
        QVariantList messages, entries;
        QByteArray bytes;
        QString path, fileName, error, clipboardText, topology, lease;
        QUuid clipboardRequest;
        QSet<unsigned int> pressedKeys;
        int pointerX{0}, pointerY{0}, pointerMask{0}, eventCount{0};
        qint64 inputDeadline{0};
        bool pending{false}, complete{false}, clipboardPending{false}, clipboardReady{false};
        bool upload{false};
        qint64 uploadOffset{0};
        ComputerControlInterface::UpdateMode previousUpdateMode{ComputerControlInterface::UpdateMode::Basic};
        QMetaObject::Connection frameConnection;
    };
    void releaseInput(BrowserSession& session);
    void closeBrowserSession(BrowserSession& session);
    void pruneBrowserSessions();
    QMutex m_browserMutex;
    QHash<QString, BrowserSession> m_browserSessions;
    QTimer m_browserSessionTimer;
    bool allowed(bool clipboard = true) const;
    FeatureList m_features;
};
