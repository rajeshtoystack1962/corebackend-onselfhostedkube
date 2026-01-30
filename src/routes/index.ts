import { Router } from 'express';
import { deployRepo } from '../controllers/DeploymentController.js';

const router = Router();

router.post('/deploy', deployRepo);

export default router;
