const connectBtn = document.getElementById('connectBtn');
const stakeBtn = document.getElementById('stakeBtn');
const unstakeBtn = document.getElementById('unstakeBtn');
const ethBalanceEl = document.getElementById('ethBalance');
const userStethEl = document.getElementById('userSteth');
const stethBalanceDisplay = document.getElementById('stethBalanceDisplay');
const rewardsEarned = document.getElementById('rewardsEarned');
const currentValue = document.getElementById('currentValue');
const stakeAmountInput = document.getElementById('stakeAmount');
const unstakeAmountInput = document.getElementById('unstakeAmount');
const unstakeAvailableEl = document.getElementById('unstakeAvailable');
const annualRewardEl = document.getElementById('annualReward');
const notification = document.getElementById('notification');
const notificationText = document.getElementById('notificationText');

let connected = false;
let ethBalance = 1.2345;
let stethBalance = 0.5;

function showNotification(text, type='success') {
  notificationText.textContent = text;
  notification.classList.add('show');
  notification.classList.remove('success','error');
  notification.classList.add(type);
  setTimeout(()=> notification.classList.remove('show'), 3000);
}

async function connectWallet() {
  if (window.ethereum) {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      connected = true;
      connectBtn.textContent = `${accounts[0].slice(0,6)}...${accounts[0].slice(-4)}`;
      connectBtn.classList.add('connected');
      stakeBtn.textContent = 'Stake ETH';
      stakeBtn.disabled = false;
      unstakeBtn.textContent = 'Unstake';
      unstakeBtn.disabled = false;
      // update balances (could fetch from chain)
      updateBalances();
      showNotification('Wallet connected', 'success');
    } catch (err) {
      showNotification('Connection rejected', 'error');
    }
  } else {
    showNotification('No Ethereum provider found', 'error');
  }
}

function updateBalances() {
  ethBalanceEl.textContent = ethBalance.toFixed(4);
  userStethEl.textContent = stethBalance.toFixed(4);
  stethBalanceDisplay.textContent = `${stethBalance.toFixed(4)} stETH`;
  unstakeAvailableEl.textContent = stethBalance.toFixed(4);
  rewardsEarned.textContent = '+0.0000 ETH';
  currentValue.textContent = `$${(stethBalance * 1800).toFixed(2)}`; // mock price
  annualRewardEl.textContent = `+${(ethBalance * 0.038).toFixed(4)} ETH`;
}

window.setMaxStake = function setMaxStake() {
  stakeAmountInput.value = ethBalance.toFixed(4);
}

window.setMaxUnstake = function setMaxUnstake() {
  unstakeAmountInput.value = stethBalance.toFixed(4);
}

window.stakeETH = async function stakeETH() {
  if (!connected) {
    showNotification('Connect wallet to stake', 'error');
    return;
  }
  const amount = parseFloat(stakeAmountInput.value);
  if (!amount || amount <= 0) {
    showNotification('Enter stake amount', 'error');
    return;
  }
  if (amount > ethBalance) {
    showNotification('Insufficient ETH balance', 'error');
    return;
  }
  stakeBtn.disabled = true;
  stakeBtn.textContent = 'Staking...';
  // simulate tx
  setTimeout(()=>{
    ethBalance -= amount;
    stethBalance += amount;
    updateBalances();
    stakeBtn.disabled = false;
    stakeBtn.textContent = 'Stake ETH';
    showNotification(`Staked ${amount} ETH`, 'success');
  }, 2000);
}

window.unstakeETH = async function unstakeETH() {
  if (!connected) {
    showNotification('Connect wallet to unstake', 'error');
    return;
  }
  const amount = parseFloat(unstakeAmountInput.value);
  if (!amount || amount <= 0) {
    showNotification('Enter unstake amount', 'error');
    return;
  }
  if (amount > stethBalance) {
    showNotification('Insufficient stETH balance', 'error');
    return;
  }
  unstakeBtn.disabled = true;
  unstakeBtn.textContent = 'Unstaking...';
  setTimeout(()=>{
    stethBalance -= amount;
    ethBalance += amount;
    updateBalances();
    unstakeBtn.disabled = false;
    unstakeBtn.textContent = 'Unstake';
    showNotification(`Unstaked ${amount} stETH`, 'success');
  }, 2000);
}

connectBtn.addEventListener('click', connectWallet);
updateBalances();
