<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MGT_API {

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	public static function register_routes() {
		$namespace = 'gearbox/v1';

		register_rest_route( $namespace, '/jobs', array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_jobs' ),
				'permission_callback' => array( __CLASS__, 'check_permission' ),
			),
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'create_job' ),
				'permission_callback' => array( __CLASS__, 'check_admin_permission' ),
			),
		) );



		register_rest_route( $namespace, '/jobs/(?P<id>\d+)', array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_job' ),
				'permission_callback' => array( __CLASS__, 'check_permission' ),
			),
			array(
				'methods'             => WP_REST_Server::EDITABLE,
				'callback'            => array( __CLASS__, 'update_job' ),
				'permission_callback' => array( __CLASS__, 'check_tech_permission' ),
			),
			array(
				'methods'             => WP_REST_Server::DELETABLE,
				'callback'            => array( __CLASS__, 'delete_job' ),
				'permission_callback' => array( __CLASS__, 'check_admin_permission' ),
			),
		) );

		register_rest_route( $namespace, '/jobs/(?P<id>\d+)/notify', array(
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'notify_customers' ),
				'permission_callback' => array( __CLASS__, 'check_tech_permission' ),
			),
		) );

		register_rest_route( $namespace, '/jobs/(?P<id>\d+)/media', array(
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'upload_media' ),
				'permission_callback' => array( __CLASS__, 'check_tech_permission' ),
			),
		) );

		register_rest_route( $namespace, '/customers', array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_customers' ),
				'permission_callback' => array( __CLASS__, 'check_admin_permission' ),
			),
		) );
        
        register_rest_route( $namespace, '/customers/invite', array(
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'invite_customer' ),
				'permission_callback' => array( __CLASS__, 'check_admin_permission' ),
			),
		) );

		register_rest_route( $namespace, '/customers/(?P<id>\d+)', array(
			array(
				'methods'             => WP_REST_Server::DELETABLE,
				'callback'            => array( __CLASS__, 'delete_customer' ),
				'permission_callback' => array( __CLASS__, 'check_admin_permission' ),
			),
		) );

		register_rest_route( $namespace, '/customers/(?P<id>\d+)/reset-password', array(
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'reset_password_customer' ),
				'permission_callback' => array( __CLASS__, 'check_admin_permission' ),
			),
		) );

		register_rest_route( $namespace, '/customers/(?P<id>\d+)/link', array(
			array(
				'methods'             => WP_REST_Server::EDITABLE,
				'callback'            => array( __CLASS__, 'update_customer_links' ),
				'permission_callback' => array( __CLASS__, 'check_admin_permission' ),
			),
		) );

		register_rest_route( $namespace, '/settings', array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_settings' ),
				'permission_callback' => array( __CLASS__, 'check_admin_permission' ),
			),
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'update_settings' ),
				'permission_callback' => array( __CLASS__, 'check_admin_permission' ),
			),
		) );

		register_rest_route( $namespace, '/techs', array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_techs' ),
				'permission_callback' => array( __CLASS__, 'check_tech_permission' ),
			),
		) );
	}

	public static function check_permission() {
		return is_user_logged_in();
	}

	public static function check_admin_permission() {
		return current_user_can( 'manage_options' ) || current_user_can( 'shop_manager' );
	}

	public static function check_tech_permission() {
		return self::check_admin_permission() || current_user_can( 'geartech' );
	}

	public static function get_jobs( $request ) {
		$user_id = get_current_user_id();
		$is_admin = self::check_admin_permission();

		$args = array(
			'post_type'      => 'gearbox_job',
			'posts_per_page' => -1,
			'post_status'    => 'publish',
		);

		if ( ! $is_admin ) {
			if ( current_user_can( 'geartech' ) ) {
				$args['meta_query'] = array(
					array(
						'key'   => '_tech_id',
						'value' => $user_id,
					),
				);
			} else {
				$linked_jobs = get_user_meta( $user_id, '_linked_jobs', true );
				if ( empty( $linked_jobs ) ) {
					return rest_ensure_response( array() );
				}
				$args['post__in'] = $linked_jobs;
			}
		}

		$jobs = get_posts( $args );

		// Prime the post meta cache in a single query (eliminates N+1)
		$post_ids = wp_list_pluck( $jobs, 'ID' );
		if ( ! empty( $post_ids ) ) {
			update_meta_cache( 'post', $post_ids );
		}

		$data = array();
		foreach ( $jobs as $job ) {
			$data[] = self::format_job_light( $job->ID );
		}

		return rest_ensure_response( $data );
	}

	public static function get_job( $request ) {
		$post_id = (int) $request['id'];
		$post = get_post( $post_id );

		if ( ! $post || 'gearbox_job' !== $post->post_type ) {
			return new WP_Error( 'not_found', 'Work order not found', array( 'status' => 404 ) );
		}

		// Customers or Techs can only access their allowed jobs
		if ( ! self::check_admin_permission() ) {
			$user_id = get_current_user_id();
			if ( current_user_can( 'geartech' ) ) {
				$tech_id = get_post_meta( $post_id, '_tech_id', true );
				if ( (int) $tech_id !== $user_id ) {
					return new WP_Error( 'forbidden', 'Access denied', array( 'status' => 403 ) );
				}
			} else {
				$linked_jobs = get_user_meta( $user_id, '_linked_jobs', true );
				if ( empty( $linked_jobs ) || ! in_array( $post_id, array_map( 'intval', (array) $linked_jobs ), true ) ) {
					return new WP_Error( 'forbidden', 'Access denied', array( 'status' => 403 ) );
				}
			}
		}

		return rest_ensure_response( self::format_job( $post_id ) );
	}

	public static function create_job( $request ) {
		$params = $request->get_json_params();

		$post_id = wp_insert_post( array(
			'post_title'   => sanitize_text_field( $params['desc'] ),
			'post_type'    => 'gearbox_job',
			'post_status'  => 'publish',
		) );

		if ( is_wp_error( $post_id ) ) {
			return new WP_Error( 'cant_create', 'Could not create job', array( 'status' => 500 ) );
		}

		// Use manual WO number provided by admin
		$wo_id = isset( $params['wo_id'] ) ? sanitize_text_field( $params['wo_id'] ) : '';
		
		$tech_id = isset( $params['tech_id'] ) ? sanitize_text_field( $params['tech_id'] ) : '';
		$tech_name = sanitize_text_field( $params['tech'] ?? '' );
		if ( $tech_id ) {
			$user = get_userdata( $tech_id );
			if ( $user ) $tech_name = $user->display_name;
		}

		update_post_meta( $post_id, '_wo_id', $wo_id );
		update_post_meta( $post_id, '_tech_id', $tech_id );
		update_post_meta( $post_id, '_tech', $tech_name );
		update_post_meta( $post_id, '_priority', sanitize_text_field( $params['priority'] ) );
		update_post_meta( $post_id, '_date_in', sanitize_text_field( $params['dateIn'] ) );
		update_post_meta( $post_id, '_eta', sanitize_text_field( $params['eta'] ) );
		update_post_meta( $post_id, '_failure', sanitize_text_field( $params['failure'] ?? '' ) );
		update_post_meta( $post_id, '_stage_index', 0 );
		update_post_meta( $post_id, '_archived', 0 );
		update_post_meta( $post_id, '_checklist', wp_json_encode( $params['checklist'] ) );
		update_post_meta( $post_id, '_notes', wp_json_encode( array() ) );

		// Link customer and sync both sides
		$linked_customer_ids = ! empty( $params['linkedCustomers'] ) && is_array( $params['linkedCustomers'] )
			? array_map( 'intval', $params['linkedCustomers'] )
			: array();
		self::sync_job_customer_link( $post_id, $linked_customer_ids );

		return rest_ensure_response( self::format_job( $post_id ) );
	}



	public static function update_job( $request ) {
		$post_id = $request['id'];
		$params = $request->get_json_params();

		if ( current_user_can( 'geartech' ) && ! self::check_admin_permission() ) {
			$tech_id = get_post_meta( $post_id, '_tech_id', true );
			if ( (int) $tech_id !== get_current_user_id() ) {
				return new WP_Error( 'forbidden', 'Access denied', array( 'status' => 403 ) );
			}
		}

		if ( isset( $params['desc'] ) ) {
			if ( ! current_user_can( 'geartech' ) || self::check_admin_permission() ) {
				wp_update_post( array(
					'ID'         => $post_id,
					'post_title' => sanitize_text_field( $params['desc'] )
				) );
			}
		}

		$old_stage = (int) get_post_meta( $post_id, '_stage_index', true );

		$fields = array( 'tech', 'priority', 'dateIn', 'eta', 'failure', 'stageIndex' );
		foreach ( $fields as $field ) {
			if ( isset( $params[$field] ) ) {
				// Block geartechs from updating restricted fields
				if ( current_user_can( 'geartech' ) && ! self::check_admin_permission() && $field !== 'stageIndex' ) {
					continue;
				}
				$meta_key = '_' . strtolower( preg_replace('/(?<!^)[A-Z]/', '_$0', $field) );
				if ( $field === 'stageIndex' ) $meta_key = '_stage_index';
				update_post_meta( $post_id, $meta_key, sanitize_text_field( $params[$field] ) );
			}
		}

		if ( isset( $params['tech_id'] ) ) {
			if ( ! current_user_can( 'geartech' ) || self::check_admin_permission() ) {
				$tech_id = sanitize_text_field( $params['tech_id'] );
				update_post_meta( $post_id, '_tech_id', $tech_id );
				$user = get_userdata( $tech_id );
				if ( $user ) {
					update_post_meta( $post_id, '_tech', $user->display_name );
				}
			}
		}

		// Handle archived toggle
		if ( isset( $params['archived'] ) ) {
			update_post_meta( $post_id, '_archived', $params['archived'] ? 1 : 0 );
		}

		$new_stage = (int) get_post_meta( $post_id, '_stage_index', true );
		if ( $old_stage !== $new_stage ) {
			self::send_stage_update_email( $post_id, $new_stage );
		}

		// Handle JSON arrays specially
		if ( isset( $params['checklist'] ) ) {
			update_post_meta( $post_id, '_checklist', wp_json_encode( $params['checklist'] ) );
		}
		if ( isset( $params['notes'] ) ) {
			if ( ! current_user_can( 'geartech' ) || self::check_admin_permission() ) {
				update_post_meta( $post_id, '_notes', wp_json_encode( $params['notes'] ) );
			}
		}
		if ( isset( $params['linkedCustomers'] ) && is_array( $params['linkedCustomers'] ) ) {
			if ( ! current_user_can( 'geartech' ) || self::check_admin_permission() ) {
				self::sync_job_customer_link( $post_id, array_map( 'intval', $params['linkedCustomers'] ) );
			}
		}

		return rest_ensure_response( self::format_job( $post_id ) );
	}

	public static function delete_job( $request ) {
		$post_id = $request['id'];
		wp_delete_post( $post_id, true );
		return rest_ensure_response( array( 'success' => true ) );
	}

	public static function get_techs( $request ) {
		$users = get_users( array( 'role' => 'geartech' ) );
		$data = array();
		foreach ( $users as $user ) {
			$data[] = array(
				'id'    => $user->ID,
				'name'  => $user->display_name,
				'email' => $user->user_email,
			);
		}
		return rest_ensure_response( $data );
	}

	public static function get_customers( $request ) {
		$users = get_users( array( 'role__in' => array( 'geartech', 'gearbox_customer', 'shop_manager', 'administrator' ) ) );
		$data = array();

		foreach ( $users as $user ) {
			$linked_jobs_meta = get_user_meta( $user->ID, '_linked_jobs', true );
			$linked_jobs = empty( $linked_jobs_meta ) ? array() : $linked_jobs_meta;

			// Fetch the WO IDs for the linked job post IDs
			$linked_wo_ids = array();
			if(!empty($linked_jobs) && is_array($linked_jobs)) {
				foreach($linked_jobs as $job_id) {
					$wo_id = get_post_meta($job_id, '_wo_id', true);
					if($wo_id) {
						$linked_wo_ids[] = $wo_id;
					}
				}
			}

			$role = 'customer';
			$role_label = 'Customer';
			if ( in_array( 'administrator', (array) $user->roles ) ) {
				$role = 'admin';
				$role_label = 'Administrator';
			} elseif ( in_array( 'shop_manager', (array) $user->roles ) ) {
				$role = 'admin';
				$role_label = 'Shop Manager';
			}

			$data[] = array(
				'id'         => $user->ID,
				'name'       => $user->display_name,
				'email'      => $user->user_email,
				'company'    => get_user_meta( $user->ID, 'company', true ),
				'linkedJobs' => $linked_wo_ids,
				'role'       => $role,
				'roleLabel'  => $role_label,
			);
		}
		return rest_ensure_response( $data );
	}

	public static function update_customer_links( $request ) {
		$user_id = (int) $request['id'];
		$params  = $request->get_json_params();
		$linked_wo_ids = isset( $params['linkedJobs'] ) ? $params['linkedJobs'] : array();

		$user = get_userdata( $user_id );
		if ( ! $user ) {
			return new WP_Error( 'not_found', 'User not found', array( 'status' => 404 ) );
		}

		// Convert WO ID strings → post IDs
		$new_post_ids = array();
		foreach ( (array) $linked_wo_ids as $wo_id ) {
			$posts = get_posts( array(
				'post_type'      => 'gearbox_job',
				'meta_key'       => '_wo_id',
				'meta_value'     => $wo_id,
				'posts_per_page' => 1,
			) );
			if ( ! empty( $posts ) ) {
				$new_post_ids[] = (int) $posts[0]->ID;
			}
		}

		// Get old linked jobs to detect removals
		$old_post_ids = (array) get_user_meta( $user_id, '_linked_jobs', true );
		$old_post_ids = array_map( 'intval', array_filter( $old_post_ids ) );

		// Save new list on user
		update_user_meta( $user_id, '_linked_jobs', $new_post_ids );

		// Sync _linked_customers on every affected job
		$all_affected = array_unique( array_merge( $old_post_ids, $new_post_ids ) );
		foreach ( $all_affected as $post_id ) {
			$current = (array) get_post_meta( $post_id, '_linked_customers', true );
			$current = array_map( 'intval', array_filter( $current ) );
			if ( in_array( $post_id, $new_post_ids, true ) ) {
				// Add user to this job's linked customers
				if ( ! in_array( $user_id, $current, true ) ) {
					$current[] = $user_id;
				}
			} else {
				// Remove user from this job's linked customers
				$current = array_values( array_diff( $current, array( $user_id ) ) );
			}
			update_post_meta( $post_id, '_linked_customers', $current );
		}

		return rest_ensure_response( array( 'success' => true ) );
	}

	/**
	 * Sync helper — keeps _linked_customers on the job and _linked_jobs on each user
	 * in perfect sync whenever the job side is updated.
	 *
	 * @param int   $post_id          The gearbox_job post ID.
	 * @param int[] $new_customer_ids Array of WP user IDs to link.
	 */
	private static function sync_job_customer_link( $post_id, array $new_customer_ids ) {
		$old_customer_ids = (array) get_post_meta( $post_id, '_linked_customers', true );
		$old_customer_ids = array_map( 'intval', array_filter( $old_customer_ids ) );

		// Save on the job
		update_post_meta( $post_id, '_linked_customers', $new_customer_ids );

		$added   = array_diff( $new_customer_ids, $old_customer_ids );
		$removed = array_diff( $old_customer_ids, $new_customer_ids );

		// Add this job to newly linked users
		foreach ( $added as $uid ) {
			$jobs = (array) get_user_meta( $uid, '_linked_jobs', true );
			$jobs = array_map( 'intval', array_filter( $jobs ) );
			if ( ! in_array( $post_id, $jobs, true ) ) {
				$jobs[] = $post_id;
				update_user_meta( $uid, '_linked_jobs', $jobs );
			}
		}

		// Remove this job from unlinked users
		foreach ( $removed as $uid ) {
			$jobs = (array) get_user_meta( $uid, '_linked_jobs', true );
			$jobs = array_values( array_diff( array_map( 'intval', $jobs ), array( $post_id ) ) );
			update_user_meta( $uid, '_linked_jobs', $jobs );
		}
	}

    public static function invite_customer( $request ) {
        $params = $request->get_json_params();
        $email = sanitize_email( $params['email'] );
        $name = sanitize_text_field( $params['name'] );
        $message = sanitize_textarea_field( $params['message'] );
        $job_ref = sanitize_text_field( $params['job_ref'] );

		$user = get_user_by( 'email', $email );
		if ( ! $user ) {
			// Create user
			$random_password = wp_generate_password( 12, false );
			$user_id = wp_create_user( $email, $random_password, $email );
			if ( is_wp_error( $user_id ) ) return $user_id;
			$user = get_userdata( $user_id );
			$user->set_role( 'gearbox_customer' );
			wp_update_user( array( 'ID' => $user_id, 'display_name' => $name ) );
		}

		// Link job if provided and matches a WO ID — use sync helper to keep both sides in sync
		if ( ! empty( $job_ref ) ) {
			$posts = get_posts( array(
				'post_type'      => 'gearbox_job',
				'meta_key'       => '_wo_id',
				'meta_value'     => $job_ref,
				'posts_per_page' => 1,
			) );
			if ( ! empty( $posts ) ) {
				$job_post_id      = (int) $posts[0]->ID;
				$current_customers = (array) get_post_meta( $job_post_id, '_linked_customers', true );
				$current_customers = array_map( 'intval', array_filter( $current_customers ) );
				if ( ! in_array( $user->ID, $current_customers, true ) ) {
					$current_customers[] = $user->ID;
				}
				self::sync_job_customer_link( $job_post_id, $current_customers );
			}
		}

		// Send email with reset link
		$key = get_password_reset_key( $user );
		if ( is_wp_error( $key ) ) return $key;
		$reset_url = network_site_url( "wp-login.php?action=rp&key=$key&login=" . rawurlencode( $user->user_login ), 'login' );

		$settings = get_option( 'mgt_email_settings', array() );
		$template = isset( $settings['invite_email'] ) ? $settings['invite_email'] : array(
			'subject' => 'You have been invited to the Mayday Gearbox Portal',
			'body'    => "Hello {name},\n\n{message}\n\nJob Reference: {job_ref}\n\nWe have created an account for you. Please set your password by clicking the link below:\n\n{reset_url}"
		);

		$search  = array( '{name}', '{job_ref}', '{message}', '{reset_url}' );
		$replace = array( $name, $job_ref, $message, $reset_url );

		$subject = str_replace( $search, $replace, $template['subject'] );
		$body    = str_replace( $search, $replace, $template['body'] );

        $sent = wp_mail( $email, $subject, $body );

        if ( $sent ) {
            return rest_ensure_response( array( 'success' => true ) );
        } else {
            return new WP_Error( 'mail_failed', 'Could not send email. Please check your SMTP settings.', array( 'status' => 500 ) );
        }
    }

	public static function delete_customer( $request ) {
		$id = $request['id'];
		require_once( ABSPATH . 'wp-admin/includes/user.php' );
		wp_delete_user( $id );
		return rest_ensure_response( array( 'success' => true ) );
	}

	public static function reset_password_customer( $request ) {
		$id = $request['id'];
		$user = get_userdata( $id );
		if ( ! $user ) return new WP_Error( 'not_found', 'User not found', array( 'status' => 404 ) );
		
		$key = get_password_reset_key( $user );
		if ( is_wp_error( $key ) ) return $key;
		
		$reset_url = network_site_url( "wp-login.php?action=rp&key=$key&login=" . rawurlencode( $user->user_login ), 'login' );
		
		$message = "Hello,\n\nSomeone requested to reset the password for your account.\n\n";
		$message .= "If this was a mistake, ignore this email. To reset your password, visit the following address:\n";
		$message .= $reset_url;
		
		wp_mail( $user->user_email, 'Password Reset Request', $message );
		return rest_ensure_response( array( 'success' => true ) );
	}

	public static function get_settings( $request ) {
		$settings = get_option( 'mgt_email_settings', array() );
		$stages = array( 'Intake', 'Teardown', 'Inspection', 'Parts', 'Rebuild', /* 'Spin Test', */ 'Painting', 'Complete' );
		foreach ( $stages as $idx => $stage ) {
			$default = array(
				'enabled' => true,
				'subject' => "Work Order Update: {wo_id} is now in {stage_name} stage",
				'body'    => "Hello,\n\nYour work order ({wo_id}) has been moved to the following stage: {stage_name}.\n\nYou can log in to our portal to view more details and photos.\n\nThank you,\nMayday Gearbox Repair"
			);
			if ( ! isset( $settings["stage_$idx"] ) ) {
				$settings["stage_$idx"] = $default;
			} elseif ( ! is_array( $settings["stage_$idx"] ) ) {
				// Migrate legacy boolean
				$default['enabled'] = (bool) $settings["stage_$idx"];
				$settings["stage_$idx"] = $default;
			} else {
				// Ensure keys exist
				if ( ! isset( $settings["stage_$idx"]['subject'] ) ) $settings["stage_$idx"]['subject'] = $default['subject'];
				if ( ! isset( $settings["stage_$idx"]['body'] ) ) $settings["stage_$idx"]['body'] = $default['body'];
			}
		}

		if ( ! isset( $settings['invite_email'] ) ) {
			$settings['invite_email'] = array(
				'subject' => 'You have been invited to the Mayday Gearbox Portal',
				'body'    => "Hello {name},\n\n{message}\n\nJob Reference: {job_ref}\n\nWe have created an account for you. Please set your password by clicking the link below:\n\n{reset_url}"
			);
		}
		if ( ! isset( $settings['update_email'] ) ) {
			$settings['update_email'] = array(
				'subject' => 'Work Order Update: {wo_id}',
				'body'    => "Hello,\n\nYou have a new update on your work order ({wo_id}):\n\n{text}\n\nYou can log in to the portal to view the full update with photos.\n\nThank you,\nMayday Gearbox Repair"
			);
		}

		return rest_ensure_response( $settings );
	}

	public static function update_settings( $request ) {
		$params = $request->get_json_params();
		update_option( 'mgt_email_settings', $params );
		return rest_ensure_response( array( 'success' => true ) );
	}

	public static function upload_media( $request ) {
		$post_id = $request['id'];
		
		if ( current_user_can( 'geartech' ) && ! self::check_admin_permission() ) {
			$tech_id = get_post_meta( $post_id, '_tech_id', true );
			if ( (int) $tech_id !== get_current_user_id() ) {
				return new WP_Error( 'forbidden', 'Access denied', array( 'status' => 403 ) );
			}
		}

		if ( empty( $_FILES ) ) {
			return new WP_Error( 'no_files', 'No files provided', array( 'status' => 400 ) );
		}

		require_once( ABSPATH . 'wp-admin/includes/image.php' );
		require_once( ABSPATH . 'wp-admin/includes/file.php' );
		require_once( ABSPATH . 'wp-admin/includes/media.php' );

		$attachments = array();
		foreach ( $_FILES as $file_id => $file ) {
			$attachment_id = media_handle_upload( $file_id, $post_id );
			if ( ! is_wp_error( $attachment_id ) ) {
				$attachments[] = array(
					'id'  => $attachment_id,
					'url' => wp_get_attachment_url( $attachment_id )
				);
			}
		}

		return rest_ensure_response( array( 'success' => true, 'attachments' => $attachments ) );
	}

	public static function notify_customers( $request ) {
		$post_id = (int) $request['id'];
		$params  = $request->get_json_params();

		if ( current_user_can( 'geartech' ) && ! self::check_admin_permission() ) {
			$tech_id = get_post_meta( $post_id, '_tech_id', true );
			if ( (int) $tech_id !== get_current_user_id() ) {
				return new WP_Error( 'forbidden', 'Access denied', array( 'status' => 403 ) );
			}
		}

		$text    = isset( $params['text'] ) ? sanitize_textarea_field( $params['text'] ) : '';
		$files   = isset( $params['attachments'] ) && is_array( $params['attachments'] ) ? $params['attachments'] : array();

		$wo_id = get_post_meta( $post_id, '_wo_id', true );
		$linked_customers = get_post_meta( $post_id, '_linked_customers', true );
		if ( empty( $linked_customers ) || ! is_array( $linked_customers ) ) {
			return rest_ensure_response( array( 'success' => true, 'sent' => 0 ) );
		}

		$settings = get_option( 'mgt_email_settings', array() );
		$template = isset( $settings['update_email'] ) ? $settings['update_email'] : array(
			'subject' => 'Work Order Update: {wo_id}',
			'body'    => "Hello,\n\nYou have a new update on your work order ({wo_id}):\n\n{text}\n\nYou can log in to the portal to view the full update with photos.\n\nThank you,\nMayday Gearbox Repair"
		);

		$search  = array( '{wo_id}', '{text}' );
		$replace = array( $wo_id, $text );

		$subject = str_replace( $search, $replace, $template['subject'] );
		$body    = str_replace( $search, $replace, $template['body'] );

		// Resolve WP attachment IDs to local file paths
		$mail_attachments = array();
		foreach ( $files as $f ) {
			if ( ! empty( $f['id'] ) ) {
				$path = get_attached_file( (int) $f['id'] );
				if ( $path && file_exists( $path ) ) {
					$mail_attachments[] = $path;
				}
			}
		}

		$sent = 0;
		foreach ( $linked_customers as $customer_id ) {
			$user = get_userdata( (int) $customer_id );
			if ( $user && wp_mail( $user->user_email, $subject, $body, '', $mail_attachments ) ) {
				$sent++;
			}
		}

		return rest_ensure_response( array( 'success' => true, 'sent' => $sent ) );
	}

	private static function send_stage_update_email( $post_id, $new_stage ) {
		$settings = get_option( 'mgt_email_settings', array() );
		
		$default = array(
			'enabled' => true,
			'subject' => "Work Order Update: {wo_id} is now in {stage_name} stage",
			'body'    => "Hello,\n\nYour work order ({wo_id}) has been moved to the following stage: {stage_name}.\n\nYou can log in to our portal to view more details and photos.\n\nThank you,\nMayday Gearbox Repair"
		);
		$stage_setting = isset( $settings["stage_$new_stage"] ) ? $settings["stage_$new_stage"] : $default;
		
		if ( ! is_array( $stage_setting ) ) {
			$default['enabled'] = (bool) $stage_setting;
			$stage_setting = $default;
		}

		if ( empty( $stage_setting['enabled'] ) ) {
			return; // Disabled in settings
		}

		$stages = array( 'Intake', 'Teardown', 'Inspection', 'Parts', 'Rebuild', /* 'Spin Test', */ 'Painting', 'Complete' );
		$stage_name = isset( $stages[$new_stage] ) ? $stages[$new_stage] : 'Updated';
		
		$wo_id = get_post_meta( $post_id, '_wo_id', true );
		$linked_customers = get_post_meta( $post_id, '_linked_customers', true );
		if ( empty( $linked_customers ) || ! is_array( $linked_customers ) ) return;

		$subject = str_replace( array( '{wo_id}', '{stage_name}' ), array( $wo_id, $stage_name ), $stage_setting['subject'] );
		$body    = str_replace( array( '{wo_id}', '{stage_name}' ), array( $wo_id, $stage_name ), $stage_setting['body'] );

		foreach ( $linked_customers as $customer_id ) {
			$user = get_userdata( $customer_id );
			if ( $user ) {
				wp_mail( $user->user_email, $subject, $body );
			}
		}
	}

	/**
	 * Lightweight job format for list views — no checklist, notes, or attachments.
	 * Progress is calculated server-side to avoid sending the full checklist.
	 */
	private static function format_job_light( $post_id ) {
		$post = get_post( $post_id );
		$checklist_raw = get_post_meta( $post_id, '_checklist', true );
		$checklist = ! empty( $checklist_raw ) ? json_decode( $checklist_raw, true ) : array();

		$total = 0;
		$done  = 0;
		if ( is_array( $checklist ) ) {
			foreach ( $checklist as $group ) {
				if ( isset( $group['items'] ) && is_array( $group['items'] ) ) {
					foreach ( $group['items'] as $item ) {
						$total++;
						if ( ! empty( $item['done'] ) ) {
							$done++;
						}
					}
				}
			}
		}
		$progress = $total === 0 ? 0 : (int) round( ( $done / $total ) * 100 );

		$linked_customers = get_post_meta( $post_id, '_linked_customers', true );
		if ( ! is_array( $linked_customers ) ) $linked_customers = array();

		return array(
			'db_id'           => $post_id,
			'id'              => get_post_meta( $post_id, '_wo_id', true ),
			'desc'            => $post->post_title,
			'tech'            => get_post_meta( $post_id, '_tech', true ),
			'tech_id'         => get_post_meta( $post_id, '_tech_id', true ),
			'priority'        => get_post_meta( $post_id, '_priority', true ),
			'dateIn'          => get_post_meta( $post_id, '_date_in', true ),
			'eta'             => get_post_meta( $post_id, '_eta', true ),
			'failure'         => get_post_meta( $post_id, '_failure', true ),
			'stageIndex'      => (int) get_post_meta( $post_id, '_stage_index', true ),
			'progress'        => $progress,
			'linkedCustomers' => $linked_customers,
			'archived'        => (bool) get_post_meta( $post_id, '_archived', true ),
		);
	}

	/**
	 * Full job format for detail view — includes checklist, notes, attachments, and progress.
	 */
	private static function format_job( $post_id ) {
		$post = get_post( $post_id );
		$checklist_raw = get_post_meta( $post_id, '_checklist', true );
		$notes_raw     = get_post_meta( $post_id, '_notes', true );
		$checklist     = ! empty( $checklist_raw ) ? json_decode( $checklist_raw, true ) : array();
		$notes         = ! empty( $notes_raw ) ? json_decode( $notes_raw, true ) : array();

		$total = 0;
		$done  = 0;
		if ( is_array( $checklist ) ) {
			foreach ( $checklist as $group ) {
				if ( isset( $group['items'] ) && is_array( $group['items'] ) ) {
					foreach ( $group['items'] as $item ) {
						$total++;
						if ( ! empty( $item['done'] ) ) {
							$done++;
						}
					}
				}
			}
		}
		$progress = $total === 0 ? 0 : (int) round( ( $done / $total ) * 100 );

		$linked_customers = get_post_meta( $post_id, '_linked_customers', true );
		if ( ! is_array( $linked_customers ) ) $linked_customers = array();

		return array(
			'db_id'           => $post_id,
			'id'              => get_post_meta( $post_id, '_wo_id', true ),
			'desc'            => $post->post_title,
			'tech'            => get_post_meta( $post_id, '_tech', true ),
			'tech_id'         => get_post_meta( $post_id, '_tech_id', true ),
			'priority'        => get_post_meta( $post_id, '_priority', true ),
			'dateIn'          => get_post_meta( $post_id, '_date_in', true ),
			'eta'             => get_post_meta( $post_id, '_eta', true ),
			'failure'         => get_post_meta( $post_id, '_failure', true ),
			'stageIndex'      => (int) get_post_meta( $post_id, '_stage_index', true ),
			'progress'        => $progress,
			'checklist'       => $checklist,
			'notes'           => $notes,
			'linkedCustomers' => $linked_customers,
			'archived'        => (bool) get_post_meta( $post_id, '_archived', true ),
			'photos'          => self::get_attachments_by_mime( $post_id, 'image' ),
			'pdfs'            => self::get_attachments_by_mime( $post_id, 'application/pdf' ),
		);
	}

	private static function get_attachments_by_mime( $post_id, $mime_type_prefix ) {
		$args = array(
			'post_type'      => 'attachment',
			'post_parent'    => $post_id,
			'posts_per_page' => -1,
		);
		$attachments = get_posts( $args );
		$results = array();
		
		foreach ( $attachments as $att ) {
			if ( strpos( $att->post_mime_type, $mime_type_prefix ) === 0 ) {
				$results[] = array(
					'id'   => $att->ID,
					'data' => wp_get_attachment_url( $att->ID ),
					'name' => basename( get_attached_file( $att->ID ) )
				);
			}
		}
		return $results;
	}
}
