import { doordashDriveClient, instacartClient, taskRabbitClient } from "../apiClients";

/**
 * "Concierge services" integration module — errands and on-demand help
 * that don't fit neatly into travel/transport/shopping: food delivery,
 * grocery delivery, and task/errand outsourcing. DoorDash Drive is wired
 * to a real sandbox call; Instacart/TaskRabbit have no self-serve API yet
 * (see INTEGRATIONS.md) and always report unavailable.
 */

export interface DeliveryRequest {
  userId: string;
  restaurantOrStore: string;
  items: string[];
  address: string;
}

export interface TaskRequest {
  userId: string;
  description: string;
  location: string;
  budget?: number;
}

export async function requestFoodDelivery(req: DeliveryRequest) {
  return doordashDriveClient.createDelivery(req);
}

export async function requestGroceryDelivery(req: DeliveryRequest) {
  return instacartClient.createShoppingList({ userId: req.userId, items: req.items });
}

export async function requestTaskHelp(req: TaskRequest) {
  return taskRabbitClient.postTask(req);
}
