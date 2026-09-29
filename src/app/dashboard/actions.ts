"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { validateNigerianPhone } from "@/lib/phone";
import {
  createOrder,
  type CreateOrderInput,
  getSelfVendor,
  getVendorToken,
  refundOrder,
  resolveDispute,
  setVendorActive,
  updateVendorPhone,
  updateVendorProfile,
  VendorApiError,
} from "@/lib/vendor-api";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

function failure(error: unknown): ActionResult {
  if (error instanceof VendorApiError) return { ok: false, message: error.message };
  return {
    ok: false,
    message: "Something went wrong while contacting InstaSafe. Try again.",
  };
}

function requireVendorId(formData: FormData) {
  const id = String(formData.get("vendorId") ?? "").trim();
  if (!id) throw new VendorApiError("Missing vendor reference.", 400);
  return id;
}

export async function renameBusinessAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const token = await getVendorToken();
  if (!token) redirect("/login");

  const displayName = String(formData.get("displayName") ?? "").trim();
  if (displayName.length < 2) {
    return { ok: false, message: "Enter a business name with at least 2 characters." };
  }
  if (displayName.length > 120) {
    return { ok: false, message: "Business names are limited to 120 characters." };
  }

  try {
    await updateVendorProfile(token, requireVendorId(formData), displayName);
  } catch (error) {
    return failure(error);
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: `Business renamed to ${displayName}.` };
}

export async function updatePhoneAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const token = await getVendorToken();
  if (!token) redirect("/login");

  const phone = String(formData.get("phone") ?? "").trim();
  const digits = phone.replace(/\D/g, "");
  const isValid =
    /^234\d{10}$/.test(digits) || /^0(70|80|81|90|91)\d{8}$/.test(digits);
  if (!isValid) {
    return {
      ok: false,
      message: "Enter a valid Nigerian mobile number, for example 0801 234 5678.",
    };
  }

  let vendorId = "";
  try {
    vendorId = requireVendorId(formData);
    await updateVendorPhone(token, vendorId, phone);
  } catch (error) {
    return failure(error);
  }

  // The JWT embeds the old phone number, so the session is no longer usable.
  revalidatePath("/dashboard", "layout");
  redirect(
    `/login?phone=${encodeURIComponent(phone)}&notice=phone-changed&vendorId=${encodeURIComponent(vendorId)}`,
  );
}

export async function setActiveAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const token = await getVendorToken();
  if (!token) redirect("/login");

  const active = String(formData.get("active")) === "true";

  try {
    await setVendorActive(token, requireVendorId(formData), active);
  } catch (error) {
    return failure(error);
  }

  revalidatePath("/dashboard", "layout");
  return {
    ok: true,
    message: active
      ? "Your vendor account is active again."
      : "Your vendor account is deactivated. Reactivate to resume selling.",
  };
}

export async function createOrderAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const token = await getVendorToken();
  if (!token) redirect("/login");

  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const customerName = text("customerName");
  const customerPhone = text("customerPhone");
  const deliveryAddress = text("deliveryAddress");
  const buyerEmail = text("buyerEmail");
  // `fulfillment` is a number the vendor picks, and only 0 and 2 are accepted:
  // 1 (Digital) is disabled server-side (`400 fulfillment.unsupported`). A `1`
  // reaching here means a stale client, so refuse it rather than let the API
  // reject it with a code the vendor cannot act on.
  const fulfillmentRaw = text("fulfillment");
  if (fulfillmentRaw === "1") {
    return {
      ok: false,
      message:
        "Digital orders are no longer available. Choose a rider, or pick that you deliver it yourself.",
    };
  }
  const fulfillment: 0 | 2 = fulfillmentRaw === "2" ? 2 : 0;
  const isDispatch = fulfillment === 0;
  const isSelfDelivery = fulfillment === 2;
  const deliveryFeeNgn = Number(text("deliveryFeeNgn") || 0);
  const driverPhone = text("driverPhone");
  const driverAccountNumber = text("driverAccountNumber");
  const driverBankCode = text("driverBankCode");

  if (!customerName) return { ok: false, message: "Enter the buyer's name." };
  const phoneError = validateNigerianPhone(customerPhone);
  if (phoneError) return { ok: false, message: `Buyer phone — ${phoneError}` };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
    return {
      ok: false,
      message: "Enter a real buyer email. Receipts and status mails go there.",
    };
  }
  if (!Number.isFinite(deliveryFeeNgn) || deliveryFeeNgn < 0) {
    return { ok: false, message: "Delivery fee must be zero or more." };
  }
  if (!deliveryAddress) {
    return {
      ok: false,
      message: "Enter the address the order is going to.",
    };
  }
  // A self-delivery order has no rider, so it must carry no rider fee. Whatever
  // the vendor charges the buyer for delivery belongs in the order total.
  if (isSelfDelivery && deliveryFeeNgn !== 0) {
    return {
      ok: false,
      message:
        "You are delivering this yourself, so there is no rider fee. Put any delivery charge into the order total instead.",
    };
  }

  // Dispatch and self-delivery are mutually exclusive server-side:
  //   fulfillment 0 with no driverPhone -> 400 fulfillment.dispatch_needs_rider
  //   fulfillment 2 with a driverPhone  -> 400 fulfillment.selfdelivery_no_rider
  // Riders hold no stored bank details, so on the rider path all three go on
  // this order; on the self-delivery path none of them may.
  const driverFields = [
    driverPhone,
    driverAccountNumber,
    driverBankCode,
  ].filter(Boolean).length;

  if (isDispatch) {
    if (driverFields === 0) {
      return {
        ok: false,
        message:
          "A rider order needs a rider. Add the rider's phone, account number and bank.",
      };
    }
    if (driverFields < 3) {
      return {
        ok: false,
        message:
          "Give the rider's phone, account number and bank together — riders have no saved payout details.",
      };
    }
    // The rider bank fields carry a holder-name check token. The vendor
    // must have verified the account (or explicitly acknowledged when
    // verification was down) for exactly these details - otherwise an
    // unverified account means the handover succeeds and the fee fails
    // silently, which is the incident this guards.
    const riderBankCheck = text("riderBankCheck");
    const riderKey = `${driverBankCode}:${driverAccountNumber}`;
    if (
      riderBankCheck !== `verified:${riderKey}` &&
      riderBankCheck !== `acknowledged:${riderKey}`
    ) {
      return {
        ok: false,
        message:
          "Verify the rider\u2019s account name before creating the order.",
      };
    }
  } else if (driverFields > 0) {
    return {
      ok: false,
      message:
        "You are delivering this yourself, so there is no rider to pay. Clear the rider details.",
    };
  }

  const descriptions = formData.getAll("itemDescription").map(String);
  const quantities = formData.getAll("itemQuantity").map(String);
  const prices = formData.getAll("itemUnitPrice").map(String);

  const items = descriptions
    .map((raw, index) => ({
      description: raw.trim(),
      quantity: Number(quantities[index] ?? 0),
      unitPriceNgn: Number(prices[index] ?? 0),
    }))
    .filter((item) => item.description);

  if (items.length === 0) {
    return { ok: false, message: "Add at least one line item." };
  }
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      return { ok: false, message: "Every item needs a whole quantity of at least 1." };
    }
    if (!Number.isFinite(item.unitPriceNgn) || item.unitPriceNgn < 0) {
      return { ok: false, message: "Every item needs a unit price of zero or more." };
    }
  }

  // The API requires vendorPhone to match the phone inside the JWT, so it comes
  // from the session rather than the form.
  const profile = await getSelfVendor(token).catch(() => null);
  if (!profile?.phone) {
    return { ok: false, message: "We could not confirm your vendor number. Try again." };
  }

  const amountNgn = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceNgn,
    0,
  );
  if (amountNgn <= 0) {
    return { ok: false, message: "The order total must be greater than zero." };
  }

  const payload: CreateOrderInput = {
    vendorPhone: profile.phone,
    customerName,
    customerPhone,
    deliveryAddress,
    buyerEmail,
    fulfillment,
    deliveryFeeNgn,
    driverPhone: driverPhone || null,
    driverAccountNumber: driverAccountNumber || null,
    driverBankCode: driverBankCode || null,
    amountNgn,
    items,
  };

  // `redirect()` signals by throwing, so it has to stay outside the try/catch
  // or the catch turns a successful create into a failure message.
  let created: Awaited<ReturnType<typeof createOrder>> = null;
  try {
    created = await createOrder(token, payload);
  } catch (error) {
    return failure(error);
  }

  revalidatePath("/dashboard/orders", "layout");
  if (created?.id) redirect(`/dashboard/orders/${created.id}`);
  return { ok: true, message: "Order created." };
}

export async function refundOrderAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const token = await getVendorToken();
  if (!token) redirect("/login");

  const orderId = String(formData.get("orderId") ?? "").trim();
  if (!orderId) return { ok: false, message: "Missing order reference." };

  try {
    await refundOrder(token, orderId);
  } catch (error) {
    return failure(error);
  }

  revalidatePath(`/dashboard/orders/${orderId}`);
  return { ok: true, message: "Refund issued to the buyer." };
}

export async function resolveDisputeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const token = await getVendorToken();
  if (!token) redirect("/login");

  const orderId = String(formData.get("orderId") ?? "").trim();
  const resolution = String(formData.get("resolution") ?? "");
  if (!orderId) return { ok: false, message: "Missing order reference." };
  if (resolution !== "release" && resolution !== "refund") {
    return { ok: false, message: "Choose whether to release or refund." };
  }

  try {
    await resolveDispute(token, orderId, resolution);
  } catch (error) {
    return failure(error);
  }

  revalidatePath(`/dashboard/orders/${orderId}`);
  return {
    ok: true,
    message: resolution === "release" ? "Funds released to you." : "Buyer refunded.",
  };
}
