export function isVerifiedAdmin(result, userId) {
  return !!userId && result?.userId === userId && result?.isSuperAdmin === true;
}

export function isAccessDenied(error) {
  return error?.status === 401 || error?.status === 403;
}
