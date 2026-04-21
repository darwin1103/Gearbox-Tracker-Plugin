# Mayday Gearbox Tracker

A comprehensive, responsive, and performance-optimized Work Order Tracking Portal built as a WordPress plugin. Designed specifically for industrial repair shops (like Gearbox repair), it provides a complete end-to-end management solution for technicians, administrators, and customers.

## 🚀 Features

- **Single Page Application (SPA) Portal:** A lightning-fast, custom frontend built with Vanilla JS that communicates seamlessly with a custom WordPress REST API.
- **Two-Tier Lazy Loading Architecture:** Optimized performance that loads lightweight job lists instantly and fetches heavy payloads (checklists, notes, and attachments) only on demand, eliminating N+1 query bottlenecks.
- **Role-Based Access Control (RBAC):**
  - **Administrators/Shop Managers:** Full control to create work orders, assign stages, write internal/external updates, upload photos/PDFs, configure settings, and access analytics.
  - **Geartech (Technicians):** Can view their assigned jobs, update their checklists, add notes, and upload attachments. They cannot edit initial WO details or modify external settings.
  - **Customers:** Secure, restricted view where they can only see work orders explicitly linked to their accounts. They can track progress and view public updates/photos without seeing internal notes.
- **Analytics & Reporting Dashboard:** Built-in real-time analytics using `Chart.js` for shop managers. Displays turnaround ETAs, monthly volume, bottlenecks per stage, technician workload, and priority distribution. Includes 1-click **CSV Data Exports**.
- **Dynamic Email & Notification Engine:**
  - Configurable notification system with a visual UI to enable/disable automated emails per stage.
  - Custom email templating utilizing dynamic variables (e.g. `{wo_id}`, `{stage_name}`).
  - Automated Customer Invitations and Manual Shop Update emails.
- **Dynamic Checklists & Progress Tracking:** Server-side calculation of repair progress based on customizable multi-stage checklists (Intake, Teardown, Inspection, Parts, Assembly, Paint, Complete).
- **Automated Workflow Features:**
  - Auto-generated Work Order IDs (`WO-YYYY-XXX`).
  - Strict customer-linking system preventing data entry errors.
  - Quick archiving of completed jobs.
  - Robust search and stage-filtering for easy navigation.
- **Media Management:** Integrated lightbox gallery for image attachments and simple PDF viewers for documents directly within the portal.

## 🛠️ Tech Stack

- **Backend:** WordPress REST API (PHP), Custom Post Types (`gearbox_job`), Meta Data Caching.
- **Frontend:** Vanilla JavaScript, HTML5, CSS3 (No heavy frontend frameworks required).
- **Security:** WordPress Nonces, Permission Callbacks, and strict user role validation.

## 📦 Installation

1. Clone or download this repository.
2. Place the `mayday-gearbox-tracker` folder inside your WordPress plugins directory: `wp-content/plugins/`.
3. Go to your WordPress Admin dashboard -> **Plugins**.
4. Activate the **Mayday Gearbox Tracker** plugin.
5. Create a new page in WordPress and use the shortcode `[gearbox_tracker]` where you want the portal to appear.
6. Make sure your users have the correct roles (`administrator`, `shop_manager`, or `gearbox_customer`) to access the portal.

## ⚙️ Configuration & Usage

- **Roles:** The plugin automatically recognizes the `gearbox_customer` role. Ensure you assign this role to clients so they can log in and view their linked work orders.
- **Portal Access:** Navigate to the page where you placed the `[gearbox_tracker]` shortcode. If not logged in, users will be prompted to do so.
- **Creating Jobs:** Admins can click "+ New Job" in the portal, fill out the initial details, and the system will automatically assign a sequential Work Order Number.
- **Updates & Attachments:** Add notes and upload files in real-time. Choose whether an update is "Visible to Customer" or "Internal only".

## 🛡️ Security Notes

- All API endpoints are protected using `permission_callback` checks.
- Media uploads check MIME types and limit access based on the WordPress authentication nonce.

## 📄 License

This project is proprietary and built for Mayday Gearbox Repair. All rights reserved.
