function calculateRiskScore(user) {
  let score = 0.0;

  // Too many failed login attempts
  if (user.failed_logins >= 5)      score += 0.4;
  else if (user.failed_logins >= 3) score += 0.2;

  // New account is higher risk
  const daysSinceReg = Math.floor(
    (Date.now() - new Date(user.createdAt).getTime()) / 86400000
  );
  if (daysSinceReg < 7) score += 0.2;

  // Billing issues
  if (user.billing_status === 'past_due')  score += 0.3;
  if (user.billing_status === 'cancelled') score += 0.1;

  return parseFloat(Math.min(score, 1.0).toFixed(2));
}

module.exports = { calculateRiskScore };
