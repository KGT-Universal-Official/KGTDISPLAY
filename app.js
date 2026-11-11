let peer = null;
let currentCode = null;
let hostStream = null;

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

// Setup Host PC (Generates Real Peer Code & Waits for Call)
async function setupHostPC() {
    try {
        hostStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always", frameRate: { ideal: 60 } },
            audio: true
        });

        currentCode = generateCode();
        document.getElementById('generated-pin').innerText = currentCode;
        document.getElementById('connection-status').innerText = "Status: Waiting for remote connection...";

        // Initialize PeerJS server listener with generated Code
        peer = new Peer("KGT-" + currentCode);

        peer.on('call', (call) => {
            call.answer(hostStream);
            document.getElementById('connection-status').innerText = "Status: 🟢 Connected & Streaming!";
        });

        hostStream.getVideoTracks()[0].onended = function() {
            alert("Screen sharing ended.");
            location.reload();
        };

    } catch (err) {
        alert("Screen share permission required!");
        location.reload();
    }
}

// Setup Receiver Client
function setupClientReceiver() {
    peer = new Peer();
}

// Connect Function with Strict Code Verification
function connectToRemotePC() {
    const inputCode = document.getElementById('input-pin').value.trim().toUpperCase();
    const errorBox = document.getElementById('error-message');

    if (inputCode.length !== 6) {
        showError("Please enter a valid 6-character code!");
        return;
    }

    errorBox.classList.add('hidden');

    // Call the host using peer ID format "KGT-[CODE]"
    const call = peer.call("KGT-" + inputCode, null);

    let connected = false;

    call.on('stream', (remoteStream) => {
        connected = true;
        document.getElementById('receiver-box').classList.add('hidden');
        document.getElementById('stream-container').classList.remove('hidden');

        const videoElem = document.getElementById('remote-video');
        videoElem.srcObject = remoteStream;
    });

    // Handle Wrong/Invalid Code or Timeout
    setTimeout(() => {
        if (!connected) {
            showError("❌ Invalid or Expired Code! Host not found.");
        }
    }, 4000);
}

function showError(msg) {
    const errorBox = document.getElementById('error-message');
    errorBox.innerText = msg;
    errorBox.classList.remove('hidden');
}

function disconnectStream() {
    location.reload();
}