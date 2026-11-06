const $ = (id) => document.getElementById(id);

function showNotice(title, message) {
  $("noticeTitle").textContent = title;
  $("noticeText").textContent = message;
  $("notice").hidden = false;
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2800);
}

function initials(name) {
  return (name || "?").trim().slice(0, 1).toUpperCase() || "?";
}

function setConnected(profile, scopes = "") {
  const name = profile.username || "Kick user";
  const letter = initials(name);
  $("statusPill").innerHTML = "<i></i> CONNECTED";
  $("statusPill").classList.add("connected");
  $("connectBtn").hidden = true;
  $("connectActions").hidden = true;
  $("accountStat").textContent = name;
  $("accountHint").textContent = "Kick account connected";
  $("oauthStat").textContent = "Connected";
  $("sideName").textContent = name;
  $("sideStatus").textContent = "Kick account connected";
  $("sideAvatar").textContent = letter;
  $("topAvatar").textContent = letter;
  $("connectionTitle").textContent = "Kick account connected";
  $("connectionDescription").textContent = "Your account is authorized with Elsisyy.";
  $("connectionIndicator").textContent = "CONNECTED";
  $("connectionIndicator").classList.add("connected");
  $("connectExplainer").hidden = true;
  $("accountCard").hidden = false;
  $("profileName").textContent = name;
  $("profileId").textContent = profile.id ? "Kick user ID: " + profile.id : "Connected Kick account";
  $("profileScopes").textContent = scopes ? "Granted scopes: " + scopes : "Granted scopes are managed by Kick";
  $("profileFallback").textContent = letter;

  const picture = $("profilePicture");
  if (profile.profilePicture) {
    picture.src = profile.profilePicture;
    picture.hidden = false;
    $("profileFallback").hidden = true;
  } else {
    picture.hidden = true;
    $("profileFallback").hidden = false;
  }
}

function setDisconnected() {
  $("statusPill").innerHTML = "<i></i> NOT CONNECTED";
  $("statusPill").classList.remove("connected");
  $("connectBtn").hidden = false;
  $("connectActions").hidden = false;
  $("accountStat").textContent = "—";
  $("accountHint").textContent = "Not connected";
  $("oauthStat").textContent = "Waiting";
  $("sideName").textContent = "Not connected";
  $("sideStatus").textContent = "Connect a Kick account";
  $("sideAvatar").textContent = "?";
  $("topAvatar").textContent = "?";
  $("connectionTitle").textContent = "Connect your Kick account";
  $("connectionDescription").textContent = "Authorize Elsisyy using Kick's official OAuth screen.";
  $("connectionIndicator").textContent = "NOT CONNECTED";
  $("connectionIndicator").classList.remove("connected");
  $("connectExplainer").hidden = false;
  $("accountCard").hidden = true;
}

async function loadAccount() {
  try {
    const response = await fetch("/api/me", { credentials: "same-origin" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load account.");
    if (data.connected && data.profile) {
      setConnected(data.profile, data.scopes);
    } else {
      setDisconnected();
      if (data.reconnectRequired) showNotice("Reconnect required", "Your Kick session expired. Connect your account again.");
      if (!data.oauthConfigured) {
        $("connectBtn").classList.add("disabled");
        $("connectBtn").removeAttribute("href");
        $("connectActionBtn").classList.add("disabled");
        $("connectActionBtn").removeAttribute("href");
        showNotice("Setup required", "The owner must add the Kick app credentials and SESSION_SECRET to the hosting environment before OAuth can start.");
      }
    }
  } catch (error) {
    setDisconnected();
    showNotice("Connection check failed", error.message);
  }
}

$("mobileMenu").addEventListener("click", () => $("sidebar").classList.toggle("open"));
$("closeNotice").addEventListener("click", () => { $("notice").hidden = true; });

$("disconnectBtn").addEventListener("click", async () => {
  $("disconnectBtn").disabled = true;
  try {
    const response = await fetch("/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    if (!response.ok) throw new Error("Disconnect failed.");
    setDisconnected();
    showToast("Kick account disconnected.");
  } catch (error) {
    showToast(error.message);
  } finally {
    $("disconnectBtn").disabled = false;
  }
});

const params = new URLSearchParams(window.location.search);
if (params.get("connected") === "1") showNotice("Kick connected", "Your Kick account was connected successfully.");
if (params.get("notice") === "oauth_not_configured") showNotice("Setup required", "Add your Kick OAuth credentials to the hosting environment first.");
if (params.get("notice") === "kick_denied") showNotice("Authorization cancelled", "Kick access was not approved. You can connect whenever you're ready.");
if (params.get("notice") === "kick_connection_failed") showNotice("Connection failed", "Kick could not complete the connection. Check the app settings and redirect URL, then try again.");
if (params.has("connected") || params.has("notice")) {
  window.history.replaceState({}, document.title, "/");
}

loadAccount();