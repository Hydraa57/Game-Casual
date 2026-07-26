import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Next 16 menamai konvensi ini `proxy` (sebelumnya `middleware`). Tugasnya
// mengarahkan `/` ke locale default dan mengenali prefiks `/id` atau `/en`.
export default createMiddleware(routing);

export const config = {
  // Lewati route internal Next dan file statis.
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
