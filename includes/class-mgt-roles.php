<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MGT_Roles {

	public static function init() {
		// Roles are added on activation, but we can hook to add caps if needed
	}

	public static function add_roles() {
		add_role(
			'gearbox_customer',
			'Gearbox Customer',
			array(
				'read' => true,
			)
		);

		add_role(
			'shop_manager',
			'Shop Manager',
			array(
				'read'                   => true,
				'edit_posts'             => true,
				'edit_other_posts'       => true,
				'edit_published_posts'   => true,
				'publish_posts'          => true,
				'read_private_posts'     => true,
				'delete_posts'           => true,
				'delete_other_posts'     => true,
				'delete_published_posts' => true,
				'delete_private_posts'   => true,
			)
		);
		
		// Add custom capabilities to admin
		$admin_role = get_role( 'administrator' );
		if ( $admin_role ) {
			// Add any specific caps here if needed later
		}
	}
}
