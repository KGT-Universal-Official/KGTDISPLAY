let peer = null;
let currentCode = null;
let hostStream = null;
let isPeerReady = false;
let dataChannel = null;

// Public STUN servers with fallback
const peerConfig = {
    config: {
        'iceServers': [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' }
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

function generateCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Setup Host PC
async function setupHostPC() {
    try {
        hostStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always", frameRate: { ideal: 60 } },
            audio: false
        });

        currentCode = generateCode();
        
        // Unique prefix with timestamp to avoid ID collision on public server
        peer = new Peer("KGT-SYS-" + currentCode, peerConfig);

        peer.on('open', (id) => {
            document.getElementById('generated-pin').innerText = currentCode;
            document.getElementById('connection-status').innerText = "Status: 🟢 Live on Web! Waiting for phone...";
        });

        peer.on('connection', (conn) => {
            dataChannel = conn;
            document.getElementById('connection-status').innerText = "Status: 🔵 Phone Connected & Controlling!";
            
            dataChannel.on('data', (data) => {
                console.log("Control data from phone:", data);
            });
        });

        peer.on('call', (call) => {
            document.getElementById('connection-status').innerText = "Status: 🟢 Streaming Active to Phone!";
            call.answer(hostStream);
        });

        peer.on('error', (err) => {
            console.error("Host Peer error:", err);
            if (err.type === 'unavailable-id') {
                location.reload();
            }
        });

        hostStream.getVideoTracks()[0].onended = function() {
            alert("Screen sharing ended.");
            location.reload();
        };

    } catch (err) {
        alert("Screen share permission denied!");
        location.reload();
    }
}

function setupClientReceiver() {
    peer = new Peer(peerConfig);

    peer.on('open', (id) => {
        console.log("Receiver ready with ID:", id);
        isPeerReady = true;
    });

    peer.on('error', (err) => {
        console.error("Receiver Peer error:", err);
        showError("Network connection error. Refresh page.");
    });
}

// Connect Function for Phone
function connectToRemotePC() {
    const inputCode = document.getElementById('input-pin').value.trim().toUpperCase();
    const errorBox = document.getElementById('error-message');

    if (!isPeerReady) {
        showError("⏳ Initializing secure network... Please wait 3 seconds.");
        return;
    }

    if (inputCode.length !== 6) {
        showError("Please enter a valid 6-character code!");
        return;
    }

    errorBox.classList.add('hidden');
    const hostId = "KGT-SYS-" + inputCode;

    // Connect DataChannel
    const conn = peer.connect(hostId);
    conn.on('open', () => {
        dataChannel = conn;
        console.log("DataChannel connected!");
    });

    const dummyStream = new MediaStream();
    console.log("Calling host:", hostId);
    const call = peer.call(hostId, dummyStream);

    if (!call) {
        showError("❌ Failed to initiate call.");
        return;
    }

    let connected = false;

    call.on('stream', (remoteStream) => {
        connected = true;
        document.getElementById('receiver-box').classList.add('hidden');
        document.getElementById('stream-container').classList.remove('hidden');

        const videoElem = document.getElementById('remote-video');
        videoElem.srcObject = remoteStream;
        videoElem.play().catch(e => console.log("Play error:", e));

        // Auto Fullscreen on Phone
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen().catch(err => console.log("Fullscreen error:", err));
        }

        // Touch Control Mapping
        videoElem.addEventListener('click', (e) => {
            const rect = videoElem.getBoundingClientRect();
            const x = (e.clientX - rect.left) / videoElem.clientWidth;
            const y = (e.clientY - rect.top) / videoElem.clientHeight;

            if (dataChannel && dataChannel.open) {
                dataChannel.send({ type: 'click', x: x, y: y });
            }
        });
    });

    call.on('error', (err) => {
        showError("❌ Connection error during call.");
    });

    setTimeout(() => {
        if (!connected) {
            showError("❌ Invalid Code or Host Offline!");
        }
    }, 8000);
}

function showError(msg) {
    const errorBox = document.getElementById('error-message');
    errorBox.innerText = msg;
    errorBox.classList.remove('hidden');
}

function disconnectStream() {
    location.reload();
}