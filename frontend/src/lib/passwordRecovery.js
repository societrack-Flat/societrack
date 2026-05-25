const PASSWORD_RECOVERY_FLAG = 'societrack_password_recovery';

export const markPasswordRecoveryPending = () => {
  try {
    sessionStorage.setItem(PASSWORD_RECOVERY_FLAG, '1');
  } catch {
    /* ignore */
  }
};

export const clearPasswordRecoveryPending = () => {
  try {
    sessionStorage.removeItem(PASSWORD_RECOVERY_FLAG);
  } catch {
    /* ignore */
  }
};

export const isPasswordRecoveryPending = () => {
  try {
    return sessionStorage.getItem(PASSWORD_RECOVERY_FLAG) === '1';
  } catch {
    return false;
  }
};
