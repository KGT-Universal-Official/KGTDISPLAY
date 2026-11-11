let peer = null;
let currentCode = null;
let hostStream = null;
let isPeerReady = false;

// Google ke Public STUN Servers jo alag-alag networks / cities mein connection pass karwayenge
const peerConfig = {
    config: {
        'iceServers': [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
        ]
    }
};

function selectRole(selectedRole) {
    document.getElementById('role-selection').classList.add('hidden');

    if (selectedRole === 'sender') {
        document.getElementById('sender-box').classList.remove('hidden');
        setupHostPC();
    } else {
        document.getElementById('receiver-box').classList.remove('hidden');
        setupClientReceiver();
    }
}

// Generate 6-Character Unique Alphanumeric Code
function generateCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Setup Host PC with STUN Config
async function setupHostPC() {
    try {
        hostStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always", frameRate: { ideal: 60 } },
            audio: false
        });

        currentCode = generateCode();
        document.getElementById('generated-pin').innerText = currentCode;
        document.getElementById('connection-status').innerText = "Status: Connecting to Signaling Server...";

        // Initialize Peer with STUN config
        peer = new Peer("KGT-" + currentCode, peerConfig);

        peer.on('open', (id) => {
            document.getElementById('connection-status').innerText = "Status: 🟢 Ready! Waiting for remote connection...";
        });

        peer.on('call', (call) => {
            document.getElementById('connection-status').innerText = "Status: 🔵 Incoming connection established! Streaming active...";
            call.answer(hostStream);
        });

        peer.on('error', (err) => {
            console.error("Peer error:", err);
            alert("Connection error: " + err.type);
        });

        hostStream.getVideoTracks()[0].onended = function() {
            alert("Screen sharing ended.");
            location.reload();
        };

    } catch (err) {
        alert("Screen share permission is required to act as host!");
        location.reload();
    }
}

// Setup Receiver Client with STUN Config
function setupClientReceiver() {
    peer = new Peer(peerConfig);

    peer.on('open', (id) => {
        console.log("Receiver connected to server. ID:", id);
        isPeerReady = true;
    });

    peer.on('error', (err) => {
        console.error("Receiver error:", err);
    });
}

// Connect Function with Code Verification
function connectToRemotePC() {
    const inputCode = document.getElementById('input-pin').value.trim().toUpperCase();
    const errorBox = document.getElementById('error-message');

    if (!isPeerReady) {
        showError("⏳ Initializing network... Please wait 2 seconds and try again.");
        return;
    }

    if (inputCode.length !== 6) {
        showError("Please enter a valid 6-character code!");
        return;
    }

    errorBox.classList.add('hidden');

    const dummyStream = new MediaStream();
    console.log("Calling host ID: KGT-" + inputCode);
    const call = peer.call("KGT-" + inputCode, dummyStream);

    if (!call) {
        showError("❌ Connection failed to initialize.");
        return;
    }

    let connected = false;

    call.on('stream', (remoteStream) => {
        connected = true;
        document.getElementById('receiver-box').classList.add('hidden');
        document.getElementById('stream-container').classList.remove('hidden');

        const videoElem = document.getElementById('remote-video');
        videoElem.srcObject = remoteStream;
        videoElem.play().catch(e => console.log("Video play error:", e));
    });

    call.on('error', (err) => {
        showError("❌ Connection dropped or failed.");
    });

    // Timeout if host is not found or wrong code
    setTimeout(() => {
        if (!connected) {
            showError("❌ Invalid Code or Host Offline! Check the code.");
        }
    }, 7000);
}

function showError(msg) {
    const errorBox = document.getElementById('error-message');
    errorBox.innerText = msg;
    errorBox.classList.remove('hidden');
}

function disconnectStream() {
    location.reload();
}