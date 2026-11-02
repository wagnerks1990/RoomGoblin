"use strict";

const installed=new WeakSet();

// Compose only the owning application's registration methods. Order preserves
// the existing guards, maintenance mirrors and response/request transformations.
// Install after writer tracking and before registering the Hub's routes.
function installApplicationBridges(app){
  if(installed.has(app))return;
  require("./veyon-keyring-bridge").installVeyonKeyringBridge(app);
  require("./veyon-dhcp-identity-bridge").installVeyonIdentityBridge(app);
  require("./veyon-update-bridge").installVeyonUpdateBridge(app);
  require("./cloudflare-bridge").installCloudflareBridge(app);
  require("./maintenance-route-bridge").installMaintenanceBridge(app);
  installed.add(app);
}

module.exports={installApplicationBridges};
