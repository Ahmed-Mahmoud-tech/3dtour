import { Router } from 'express';
import { protect, requireRole } from '../middleware/auth.js';
import {
  getProjects,
  getProject,
  getPublicProject,
  createProject,
  updateProject,
  deleteProject,
  addNode,
  updateNode,
  deleteNode,
  addHotspot,
  updateHotspot,
  deleteHotspot,
  addSign,
  updateSign,
  deleteSign,
  deleteTransition,
} from '../controllers/projectController.js';

const router = Router();

// Public route — viewer fetches project by ID (subscription-gated)
router.get('/:id/public', getPublicProject);

// Protected routes — studio CRUD (scoped per role inside the controllers).
// Create/delete are admin-only; employees only edit assigned projects.
router.use(protect);

router.route('/').get(getProjects).post(requireRole('admin'), createProject);
router
  .route('/:id')
  .get(getProject)
  .put(updateProject)
  .delete(requireRole('admin'), deleteProject);

// Node management
router.post('/:id/nodes', addNode);
router.route('/:id/nodes/:nodeId').put(updateNode).delete(deleteNode);

// Hotspot management
router.post('/:id/nodes/:nodeId/hotspots', addHotspot);
router.route('/:id/nodes/:nodeId/hotspots/:hotspotId').put(updateHotspot).delete(deleteHotspot);

// Info sign management
router.post('/:id/nodes/:nodeId/signs', addSign);
router.route('/:id/nodes/:nodeId/signs/:signId').put(updateSign).delete(deleteSign);

// Transition management
router.delete('/:id/transitions/:transitionId', deleteTransition);

export default router;
