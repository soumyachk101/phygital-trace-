import { Router } from 'express';
import captureRoutes from './capture.routes';
import verifyRoutes from './verify.routes';
import authRoutes from './auth.routes';
import healthRoutes from './health.routes';

const router = Router();

router.use('/captures', captureRoutes);
router.use('/verify', verifyRoutes);
router.use('/auth', authRoutes);
router.use('/health', healthRoutes);

export default router;
