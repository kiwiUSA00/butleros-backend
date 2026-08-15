import { Router } from "express";
import * as userStore from "../store/userStore";

const router = Router();

// GET /user - list all users
router.get("/", (_req, res) => {
  res.json(userStore.listUsers());
});

// GET /user/:id
router.get("/:id", (req, res) => {
  const user = userStore.getUser(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

// POST /user - create a user
// Body: { name, email, active?, preferences?: { mood, budgetBand, favoriteLocations } }
router.post("/", (req, res) => {
  const { name, email, active, preferences } = req.body ?? {};
  if (!name || !email) {
    return res.status(400).json({ error: "name and email are required" });
  }
  const user = userStore.createUser({ name, email, active, preferences });
  res.status(201).json(user);
});

// PUT /user/:id - update a user (including preferences)
router.put("/:id", (req, res) => {
  const updated = userStore.updateUser(req.params.id, req.body ?? {});
  if (!updated) return res.status(404).json({ error: "User not found" });
  res.json(updated);
});

// DELETE /user/:id
router.delete("/:id", (req, res) => {
  const ok = userStore.deleteUser(req.params.id);
  if (!ok) return res.status(404).json({ error: "User not found" });
  res.status(204).send();
});

export default router;
