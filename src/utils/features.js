const PLAN_FEATURES = {
  Free:       [],
  Starter:    ['analytics'],
  Pro:        ['analytics', 'api_keys'],
  Business:   ['analytics', 'api_keys', 'custom_roles'],
  Enterprise: ['analytics', 'api_keys', 'custom_roles', 'audit_logs', 'white_label'],
};

function getPlanFeatures(plan) {
  return PLAN_FEATURES[plan] || [];
}

module.exports = { PLAN_FEATURES, getPlanFeatures };
