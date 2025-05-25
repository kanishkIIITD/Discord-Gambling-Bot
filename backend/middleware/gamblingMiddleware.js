const validateBetAmount = (req, res, next) => {
  const { bets, amount } = req.body;
  
  let totalBetAmount = 0;

  if (req.path.includes('/roulette') && Array.isArray(bets)) {
    if (bets.length === 0) {
       return res.status(400).json({ message: 'No bets provided.' });
    }
    totalBetAmount = bets.reduce((sum, bet) => sum + (bet.amount || 0), 0);
  } else if (amount !== undefined) {
    totalBetAmount = amount;
  } else {
    return res.status(400).json({ message: 'Bet amount is required.' });
  }
  
  if (totalBetAmount === 0) {
     return res.status(400).json({ message: 'Bet amount cannot be zero.' });
  }

  if (totalBetAmount < 10) {
    return res.status(400).json({ message: 'Minimum total bet is 10 points.' });
  }
  
  if (req.wallet.balance < totalBetAmount) {
    return res.status(400).json({ message: 'Insufficient balance.' });
  }

  req.totalBetAmount = totalBetAmount;

  next();
};

const handleGamblingError = (error, req, res, next) => {
  console.error(`Error in ${req.path}:`, error);
  res.status(500).json({ message: 'Server error.' });
};

module.exports = {
  validateBetAmount,
  handleGamblingError
}; 