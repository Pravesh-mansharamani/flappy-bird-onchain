// Check if ethers is available
let ethersLoaded = typeof ethers !== 'undefined';

if (!ethersLoaded) {
  console.error('Ethers library not loaded!');
  // Try to reload ethers
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/ethers@5.7.2/dist/ethers.umd.min.js';
  script.async = false;
  script.onload = () => {
    ethersLoaded = true;
    console.log('Ethers loaded successfully');
    document.getElementById('errorDetails').textContent = '';
  };
  script.onerror = () => {
    console.error('Failed to load ethers.js');
    document.getElementById('errorDetails').textContent = 'Failed to load ethers.js library. Please check your internet connection.';
  };
  document.head.appendChild(script);
}

// === Polkadot Westend Asset Hub Configuration ===
const ASSET_HUB_CONFIG = {
  name: 'Westend Asset Hub',
  rpc: 'https://westend-asset-hub-eth-rpc.polkadot.io', // Westend Asset Hub testnet RPC
  chainId: 420420421, // Westend Asset Hub testnet chainId
  blockExplorer: 'https://blockscout-asset-hub.parity-chains-scw.parity.io/',
  nativeCurrency: {
    name: 'Westend Native Denomination',
    symbol: 'WND',
    decimals: 18
  }
};

// === Assets ===
const ASSETS = {
  background: 'assets/Background/Background1.png',
  ground: 'assets/Tiles/Style 1/TileStyle1.png',
  bird: [
    'assets/Player/StyleBird1/Bird1-1.png',
    'assets/Player/StyleBird1/Bird1-2.png',
    'assets/Player/StyleBird1/Bird1-3.png'
  ],
  pipeUp: 'assets/Tiles/Style 1/PipeStyle1.png',
  pipeDown: 'assets/Tiles/Style 1/PipeStyle1.png',
};

// === Canvas setup ===
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let frames = 0;
let score = 0;
let bestScore = 0;
let globalTopScore = 0;
let bird = { x: 100, y: 250, speed: 0, frame: 0, width: 34, height: 24 };
let pipes = [];
let gameOver = false;
let gameStarted = false;
let walletConnected = false;
let pipeTimer = 0;
let lastTxHash = null;

// Game parameters
const gravity = 0.25;          // Increased gravity for even faster fall
const jumpSpeed = -6.5;         // Even stronger jump power
const pipeGap = 180;          // Larger gap between pipes
const pipeWidth = 52;
const pipeSpeed = 4;          // Faster pipe speed
const pipeInterval = 120;     // Pipes appear more frequently
const firstPipeDelay = 60;    // First pipe appears sooner
const groundHeight = 112;

// UI elements
const gameOverUI = document.getElementById('gameOver');
const finalScoreSpan = document.getElementById('finalScore');
const bestScoreSpan = document.getElementById('bestScore');
const topScoreElement = document.getElementById('topScore');
const globalTopScoreElement = document.getElementById('globalTopScoreValue');
const restartBtn = document.getElementById('restartBtn');
const leaderboardElement = document.getElementById('leaderboard');
const connectionOverlay = document.getElementById('connectionOverlay');
const showLeaderboardBtn = document.getElementById('showLeaderboardBtn');
const hideLeaderboardBtn = document.getElementById('hideLeaderboardBtn');
const errorDetails = document.getElementById('errorDetails');
const playWithoutWalletBtn = document.getElementById('playWithoutWalletBtn');
const txNotification = document.getElementById('txNotification');
const viewTxLink = document.getElementById('viewTxLink');
const saveStatus = document.getElementById('saveStatus');
const txLink = document.getElementById('txLink');

// Event listeners
restartBtn.addEventListener('click', resetGame);
showLeaderboardBtn.addEventListener('click', () => { leaderboardElement.style.display = 'block'; });
hideLeaderboardBtn.addEventListener('click', () => { leaderboardElement.style.display = 'none'; });
playWithoutWalletBtn.addEventListener('click', startGameWithoutWallet);

// Load images
const images = {};
function preload(urls, cb) {
  let loaded = 0;
  const allUrls = [...new Set(urls)]; // Remove duplicates
  for (const u of allUrls) {
    const img = new Image();
    img.src = u;
    img.onload = () => {
      loaded += 1;
      if (loaded === allUrls.length) {
         cb();
      }
    };
    images[u] = img;
  }
}

// Preload assets
preload([ASSETS.background, ASSETS.ground, ASSETS.pipeUp, ASSETS.pipeDown, ...ASSETS.bird], () => {
  // Set bird dimensions based on actual image
  if (images[ASSETS.bird[0]]) { // Check if image loaded before accessing properties
    bird.width = images[ASSETS.bird[0]].width;
    bird.height = images[ASSETS.bird[0]].height;
  } else {
    console.warn("Bird image not loaded yet, using default dimensions");
  }

  // Initial draw
  draw();

  // Listen for events only after assets are loaded
  document.addEventListener('keydown', handleInput);
  canvas.addEventListener('click', handleInput);
});

function handleInput(e) {
  if (!gameStarted && !walletConnected && connectionOverlay.style.display !== 'none') {
    return; // Don't handle input if connection overlay is shown
  }

  if ((e.type === 'keydown' && e.code === 'Space') || e.type === 'click') {
    if (!gameStarted) {
      gameStarted = true;
      pipeTimer = 0; // Reset pipe timer when game starts
      requestAnimationFrame(loop);
    }
    if (!gameOver) {
      bird.speed = jumpSpeed;
    }
  }
}

function loop() {
  update();
  draw();
  if (!gameOver) requestAnimationFrame(loop);
}

function update() {
  frames++;

  // Bird physics
  bird.speed += gravity;
  bird.y += bird.speed;
  bird.frame = Math.floor(frames / 10) % ASSETS.bird.length;

  // Pipe generation with delay for first pipe
  if (gameStarted) {
    pipeTimer++;

    if (pipeTimer === firstPipeDelay || (pipeTimer > firstPipeDelay && (pipeTimer - firstPipeDelay) % pipeInterval === 0)) {
      const pipeY = Math.random() * (canvas.height - pipeGap - groundHeight - 100) + 50;
      pipes.push({
        x: canvas.width,
        yTop: pipeY - images[ASSETS.pipeUp].height,
        yBottom: pipeY + pipeGap,
        scored: false
      });
    }
  }

  // Pipe movement with increased speed
  for (const p of pipes) {
      p.x -= pipeSpeed;
  }
  pipes = pipes.filter(p => p.x > -pipeWidth);

  // Collision with ground or ceiling
  if (bird.y + bird.height > canvas.height - groundHeight || bird.y < 0) {
    return endGame();
  }

  // Collision with pipes and scoring
  for (const p of pipes) {
    // Check collision
    if (bird.x + bird.width > p.x && bird.x < p.x + pipeWidth) {
      // Top pipe collision
      if (bird.y < p.yTop + images[ASSETS.pipeUp].height ||
          bird.y + bird.height > p.yBottom) {
        return endGame();
      }
    }

    // Scoring
    if (!p.scored && p.x + pipeWidth < bird.x) {
      score++;
      p.scored = true;
    }
  }
}

function draw() {
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw background - tiled if needed
  const bgImg = images[ASSETS.background];
  const bgPattern = ctx.createPattern(bgImg, 'repeat');
  ctx.fillStyle = bgPattern;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw pipes
  for (const p of pipes) {
    // Draw top pipe (flipped)
    ctx.save();
    ctx.translate(p.x, p.yTop + images[ASSETS.pipeUp].height);
    ctx.scale(1, -1);
    ctx.drawImage(images[ASSETS.pipeUp], 0, 0);
    ctx.restore();

    // Draw bottom pipe
    ctx.drawImage(images[ASSETS.pipeDown], p.x, p.yBottom);
  }

  // Draw ground - tiled
  const groundImg = images[ASSETS.ground];
  const groundPattern = ctx.createPattern(groundImg, 'repeat-x');
  ctx.fillStyle = groundPattern;
  ctx.fillRect(0, canvas.height - groundHeight, canvas.width, groundHeight);

  // Draw bird
  ctx.drawImage(images[ASSETS.bird[bird.frame]], bird.x, bird.y);

  // Draw score
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';

  const scoreText = score.toString();
  ctx.strokeText(scoreText, canvas.width / 2, 50);
  ctx.fillText(scoreText, canvas.width / 2, 50);

  // If game hasn't started, show instructions
  if (!gameStarted && !gameOver && connectionOverlay.style.display === 'none') {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Tap or Press Space', canvas.width / 2, canvas.height / 2 - 30);
    ctx.fillText('to Start', canvas.width / 2, canvas.height / 2 + 10);
  }
}

function resetGame() {
  // Hide save status before restarting
  saveStatus.style.display = 'none';

  bird = { x: 100, y: 250, speed: 0, frame: 0, width: bird.width, height: bird.height };
  pipes = [];
  frames = 0;
  score = 0;
  gameOver = false;
  gameStarted = false;
  pipeTimer = 0;
  gameOverUI.style.display = 'none';
  leaderboardElement.style.display = 'none';
  draw();
}

function showGameOver() {
  finalScoreSpan.textContent = score;
  bestScoreSpan.textContent = bestScore;
  gameOverUI.style.display = 'block';

  // Only show leaderboard button if wallet is connected
  showLeaderboardBtn.style.display = walletConnected ? 'inline-block' : 'none';

  // Update best score for non-wallet mode
  if (score > bestScore) {
    bestScore = score;
    if (topScoreElement) {
      topScoreElement.textContent = `Top Score: ${bestScore}`;
    }

    // Save to local storage for non-wallet mode
    if (!walletConnected) {
      localStorage.setItem('flappyBestScore', bestScore);
    }
  }
}

function startGameWithoutWallet() {
  walletConnected = false;
  connectionOverlay.style.display = 'none';
  document.getElementById('walletAddress').textContent = 'Playing Offline';

  // Load best score from local storage
  const savedScore = localStorage.getItem('flappyBestScore');
  if (savedScore) {
    bestScore = Number.parseInt(savedScore, 10); // Use Number.parseInt
    if (topScoreElement) {
      topScoreElement.textContent = `Top Score: ${bestScore}`;
    }
  }
}

// Function to show transaction notification
function showTxNotification(txHash) {
  if (!txHash) return;

  lastTxHash = txHash;

  // Create link to block explorer
  const txUrl = `${ASSET_HUB_CONFIG.blockExplorer}/tx/${txHash}`;
  viewTxLink.href = txUrl;

  // Add the link to the game over screen too
  txLink.innerHTML = `<a href="${txUrl}" target="_blank">View on Explorer</a>`;

  // Show the notification
  txNotification.style.display = 'block';
  saveStatus.style.display = 'block';

  // Hide after 5 seconds
  setTimeout(() => {
    txNotification.style.display = 'none';
  }, 5000);
}

// Function to get global top score
async function fetchGlobalTopScore() {
  if (!walletConnected || !contract) return 0;

  try {
    // Query all score events with a limit to prevent too many events
    const events = await contract.queryFilter(contract.filters.ScoreUpdated(), -10000); // Only look at last 10000 blocks

    if (events.length === 0) return 0;

    // Use a more efficient approach to find the highest score
    let highestScore = 0;

    // Process all events to find the highest score
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      try {
        const eventScore = e.args.newScore.toNumber();
        highestScore = Math.max(highestScore, eventScore);
      } catch (err) {
        console.error("Error processing event score:", err);
      }
    }

    console.log("Found global top score:", highestScore);
    globalTopScore = highestScore;
    if (globalTopScoreElement) {
      globalTopScoreElement.textContent = globalTopScore;
    }

    return highestScore;
  } catch (error) {
    console.error("Error fetching global top score:", error);
    return 0;
  }
}

// Load fresh leaderboard data and update global score
async function refreshLeaderboardData() {
  if (!walletConnected || !contract) return;

  try {
    await loadLeaderboard();
    await fetchGlobalTopScore();
  } catch (error) {
    console.error("Error refreshing leaderboard data:", error);
  }
}

// === Web3 and Polkadot Integration ===
const CONTRACT_ADDRESS = '0x350108263CAf6D6b3fa9c557A12dda510FA64A15'; // Example contract
const ABI = [
  'event ScoreUpdated(address indexed player,uint256 newScore)',
  'function submitScore(uint256) public',
  'function viewScore(address) public view returns (uint256)'
];

let contract;
let address;
let provider;
let signer;
let isProcessingScoreUpdate = false; // Flag to prevent recursive calls
let isLoadingLeaderboard = false; // Flag to prevent simultaneous leaderboard loading

// Get a provider connected to the Westend Asset Hub
const getProvider = () => {
  if (!ethersLoaded) {
    throw new Error('Ethers library not available');
  }
  return new ethers.providers.JsonRpcProvider(ASSET_HUB_CONFIG.rpc, {
    chainId: ASSET_HUB_CONFIG.chainId,
    name: ASSET_HUB_CONFIG.name,
  });
};

// Get a signer from the wallet
const getSigner = async () => {
  if (!ethersLoaded) {
    throw new Error('Ethers library not available');
  }

  if (!window.ethereum) {
    throw new Error('No Ethereum wallet detected');
  }

  await window.ethereum.request({ method: 'eth_requestAccounts' });

  // Check if connected to the right network
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  const desiredChainId = `0x${ASSET_HUB_CONFIG.chainId.toString(16)}`;

  if (chainId !== desiredChainId) {
    // Try to switch to the Westend Asset Hub
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: desiredChainId }],
      });
    } catch (switchError) {
      // If the chain isn't added to MetaMask, add it
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: desiredChainId,
            chainName: ASSET_HUB_CONFIG.name,
            rpcUrls: [ASSET_HUB_CONFIG.rpc],
            nativeCurrency: ASSET_HUB_CONFIG.nativeCurrency,
            blockExplorerUrls: [ASSET_HUB_CONFIG.blockExplorer],
          }],
        });
      } else {
        throw new Error(`Please switch your wallet to ${ASSET_HUB_CONFIG.name}`);
      }
    }
  }

  // Now create the ethers provider and signer
  const ethersProvider = new ethers.providers.Web3Provider(window.ethereum);
  return ethersProvider.getSigner();
};

document.getElementById('connectWalletBtn').onclick = connectWallet;

async function connectWallet() {
  errorDetails.textContent = ''; // Clear previous errors

  try {
    // Check if ethers is defined
    if (!ethersLoaded) {
      errorDetails.textContent = 'Error: ethers library not loaded. Please refresh the page and try again.';
      return;
    }

    // Try to get a signer for the Westend Asset Hub
    try {
      signer = await getSigner();
      address = await signer.getAddress();

      // Try to connect to the contract
      provider = getProvider();

      try {
        console.log("Connecting to contract at address:", CONTRACT_ADDRESS);
        contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

        // Test the contract connection
        try {
          const currentScore = await contract.viewScore(address);
          console.log("Retrieved user score:", currentScore.toString());

          // Update UI to show connected state
          document.getElementById('walletAddress').textContent = `${address.slice(0, 6)}...${address.slice(-4)} (${ASSET_HUB_CONFIG.name})`;
          connectionOverlay.style.display = 'none';
          walletConnected = true;

          // Load user's best score
          try {
            const userScore = await contract.viewScore(address);
            bestScore = userScore.toNumber();
            if (topScoreElement) {
              topScoreElement.textContent = `Top Score: ${bestScore}`;
            }

            // Load global top score and leaderboard
            refreshLeaderboardData();

          } catch (scoreError) {
            console.error('Error loading user score:', scoreError);
            bestScore = 0;
          }

          // Set up event listener with safeguards
          const scoreUpdatedFilter = contract.filters.ScoreUpdated();
          contract.on(scoreUpdatedFilter, (eventPlayer, eventScore) => {
            // Use setTimeout to avoid blocking the UI thread
            setTimeout(() => handleScoreUpdate(eventPlayer, eventScore), 0);
          });
        } catch (testError) {
          console.error("Error testing contract connection:", testError);
          errorDetails.textContent = `Could not connect to contract: ${testError.message}`;
        }
      } catch (contractError) {
        console.error('Contract error:', contractError);
        errorDetails.textContent = `Contract error on ${ASSET_HUB_CONFIG.name}. This might be because the contract isn't deployed on this network.`;
      }
    } catch (signerError) {
      console.error('Signer error:', signerError);
      errorDetails.textContent = signerError.message || 'Failed to connect wallet to Westend Asset Hub network';
    }
  } catch (error) {
    console.error('Connection error:', error);
    errorDetails.textContent = error.message || 'Failed to connect wallet';
  }
}

async function handleScoreUpdate(player, newScore) {
  // Prevent recursive calls
  if (isProcessingScoreUpdate) return;
  isProcessingScoreUpdate = true;

  try {
    // Convert to number once to avoid multiple conversions
    const scoreNum = newScore.toNumber();

    // Update global top score if this score is higher
    if (scoreNum > globalTopScore) {
      globalTopScore = scoreNum;
      if (globalTopScoreElement) {
        globalTopScoreElement.textContent = globalTopScore;
      }
    }

    // Only update leaderboard if this is a meaningful score
    if (scoreNum > 0) {
      await loadLeaderboard();
    }

    // If it's the current player, update their best score
    // Use optional chaining in case address is null/undefined briefly
    if (player.toLowerCase() === address?.toLowerCase()) {
      if (scoreNum > bestScore) {
        bestScore = scoreNum;
        if (topScoreElement) {
          topScoreElement.textContent = `Top Score: ${bestScore}`;
        }
      }
    }
  } catch (error) {
    console.error("Error handling score update:", error);
  } finally {
    isProcessingScoreUpdate = false;
  }
}

async function endGame() {
  gameOver = true;
  showGameOver();

  // Submit score to blockchain if connected and score is higher than previous
  if (walletConnected && contract && score > 0) {
    try {
      saveStatus.innerHTML = 'Checking your best score...';
      saveStatus.style.display = 'block';
      saveStatus.style.color = '#ffffff';

      const currentScore = await contract.viewScore(address);
      console.log("Current best score on chain:", currentScore.toNumber());

      if (score > currentScore) {
        saveStatus.innerHTML = 'Preparing to save score...';

        try {
          // 1. Estimate Gas
          console.log(`Estimating gas for submitScore(${score})`);
          let estimatedGas;
          try {
            estimatedGas = await contract.estimateGas.submitScore(score);
            console.log("Estimated gas:", estimatedGas.toString());
          } catch (gasError) {
            console.error('Gas estimation failed:', gasError);
            saveStatus.innerHTML = `Failed to estimate gas. Transaction might fail. Error: ${gasError.message}`;
            saveStatus.style.color = '#ff7777';
            // Optionally, proceed without estimation or stop here
            // Let's proceed but use a higher manual limit
          }

          // 2. Submit Transaction
          saveStatus.innerHTML = 'Saving score to blockchain...';
          console.log("Submitting score:", score, "to contract:", CONTRACT_ADDRESS);

          const tx = await contract.submitScore(score, {
            gasLimit: estimatedGas ? estimatedGas.add(50000) : 400000, // Use estimated gas + buffer, or higher manual limit
          });
          console.log("Transaction sent:", tx.hash);

          // Show notification with transaction hash
          showTxNotification(tx.hash);
          saveStatus.innerHTML = `Transaction sent... Waiting for confirmation. <a href="${ASSET_HUB_CONFIG.blockExplorer}/tx/${tx.hash}" target="_blank">Check status</a>`;
          saveStatus.style.color = '#ffff77';

          // 3. Wait for Confirmation
          try {
            const receipt = await tx.wait();
            console.log("Transaction confirmed:", receipt);

            if (receipt.status === 1) {
              console.log("Transaction successful");

              // Update displayed scores immediately
              if (score > bestScore) {
                bestScore = score;
                if (topScoreElement) {
                  topScoreElement.textContent = `Top Score: ${bestScore}`;
                }
              }
              if (score > globalTopScore) {
                globalTopScore = score;
                if (globalTopScoreElement) {
                  globalTopScoreElement.textContent = globalTopScore;
                }
              }

              saveStatus.innerHTML = `Score saved on blockchain! <a href="${ASSET_HUB_CONFIG.blockExplorer}/tx/${tx.hash}" target="_blank">View on Explorer</a>`;
              saveStatus.style.color = '#00ff00';

              // Refresh leaderboard after successful transaction
              setTimeout(() => refreshLeaderboardData(), 2000);
            } else {
              console.error("Transaction failed with status:", receipt.status, "Receipt:", receipt);
              saveStatus.innerHTML = `Transaction failed on the blockchain (Status: ${receipt.status}). <a href="${ASSET_HUB_CONFIG.blockExplorer}/tx/${tx.hash}" target="_blank">View Details</a>`;
              saveStatus.style.color = '#ff7777';
            }
          } catch (waitError) {
            console.error('Error waiting for transaction:', waitError);
            saveStatus.innerHTML = `Transaction sent but confirmation failed. <a href="${ASSET_HUB_CONFIG.blockExplorer}/tx/${tx.hash}" target="_blank">Check status</a>`;
            saveStatus.style.color = '#ffff77';
          }
        } catch (txError) {
          console.error('Transaction Submission Error:', txError);
          let errorMessage = 'Failed to save score to blockchain.';

          // Check for common error patterns
          if (txError.code === 'ACTION_REJECTED' || (txError.message && txError.message.includes("user rejected"))) {
             errorMessage = "Transaction was rejected in wallet.";
          } else if (txError.code === 'INSUFFICIENT_FUNDS' || (txError.message && txError.message.includes("insufficient funds"))) {
             errorMessage = "Not enough WND to pay for transaction fees.";
          } else if (txError.reason) {
             errorMessage += ` Reason: ${txError.reason}`; // Contract revert reason
          } else if (txError.message) {
             errorMessage += ` Details: ${txError.message}`;
          }

          saveStatus.innerHTML = errorMessage;
          saveStatus.style.color = '#ff7777';
        }
      } else {
        saveStatus.innerHTML = 'Your current score is not higher than your best score on chain.';
        saveStatus.style.display = 'block';
        saveStatus.style.color = '#ffffff';
      }
    } catch (error) {
      console.error('Error checking current score:', error);
      saveStatus.innerHTML = 'Error checking your current score on chain.';
      saveStatus.style.color = '#ff7777';
      saveStatus.style.display = 'block';
    }
  }
}

async function loadLeaderboard() {
  if (!walletConnected || !contract || isLoadingLeaderboard) {
    return; // Don't try to load leaderboard if not connected or already loading
  }

  isLoadingLeaderboard = true;

  try {
    console.log("Loading leaderboard data...");
    // Limit the query to recent blocks to reduce data load
    const events = await contract.queryFilter(contract.filters.ScoreUpdated(), -10000);
    console.log(`Found ${events.length} score events`);

    const scores = {};

    // Process events from newest to oldest to get the most recent score per player
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      const player = e.args.player;

      // Only process each player once (their most recent score)
      if (!scores[player]) {
        scores[player] = e.args.newScore.toNumber();
      }
    }

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const ol = document.getElementById('scoresList');
    ol.innerHTML = '';

    if (sorted.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No scores yet!';
      ol.appendChild(li);
      return;
    }

    // Update global top score from leaderboard data if available
    if (sorted.length > 0) {
      const topLeaderboardScore = sorted[0][1];
      if (topLeaderboardScore > globalTopScore) {
        globalTopScore = topLeaderboardScore;
        if (globalTopScoreElement) {
          globalTopScoreElement.textContent = globalTopScore;
        }
        console.log("Updated global top score from leaderboard:", globalTopScore);
      }
    }

    for (const [p, s] of sorted) {
      const li = document.createElement('li');
      const shortAddr = `${p.slice(0, 6)}...${p.slice(-4)}`;
      li.textContent = `${shortAddr}: ${s}`; 

      // Add explorer link
      const explorerLink = document.createElement('a');
      explorerLink.href = `${ASSET_HUB_CONFIG.blockExplorer}/address/${p}`;
      explorerLink.target = '_blank';
      explorerLink.textContent = '🔍';
      explorerLink.style.marginLeft = '5px';
      li.appendChild(explorerLink);

      // Highlight current user
      if (p.toLowerCase() === address?.toLowerCase()) {
        li.style.fontWeight = 'bold';
        li.style.color = '#ffff00';
      }

      ol.appendChild(li);
    }
  } catch (error) {
    console.error('Error loading leaderboard:', error);
    const ol = document.getElementById('scoresList');
    ol.innerHTML = '<li>Error loading leaderboard</li>';
  } finally {
    isLoadingLeaderboard = false;
  }
}

// Check if there's a saved offline best score
const savedOfflineScore = localStorage.getItem('flappyBestScore');
if (savedOfflineScore) {
  bestScore = Number.parseInt(savedOfflineScore, 10); // Use Number.parseInt
  if (topScoreElement) {
    topScoreElement.textContent = `Top Score: ${bestScore}`;
  }
}

// Check if wallet was already connected in this session
if (typeof window.ethereum !== 'undefined' && window.ethereum.selectedAddress) {
  connectWallet();
} 