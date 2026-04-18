<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MGT_CPT {

	public static function init() {
		add_action( 'init', array( __CLASS__, 'register_cpt' ) );
		add_action( 'add_meta_boxes', array( __CLASS__, 'add_custom_meta_boxes' ) );

		// Custom columns on Work Orders list table
		add_filter( 'manage_gearbox_job_posts_columns', array( __CLASS__, 'set_job_columns' ) );
		add_action( 'manage_gearbox_job_posts_custom_column', array( __CLASS__, 'render_job_column' ), 10, 2 );

		// Custom column on Users list table
		add_filter( 'manage_users_columns', array( __CLASS__, 'set_user_columns' ) );
		add_filter( 'manage_users_custom_column', array( __CLASS__, 'render_user_column' ), 10, 3 );
	}

	public static function add_custom_meta_boxes() {
		add_meta_box(
			'mgt_job_details',
			'Work Order Details (Read-Only)',
			array( __CLASS__, 'render_meta_box' ),
			'gearbox_job',
			'normal',
			'high'
		);
	}

	public static function render_meta_box( $post ) {
		$wo_id = get_post_meta( $post->ID, '_wo_id', true );
		$customer = get_post_meta( $post->ID, '_customer', true );
		$tech = get_post_meta( $post->ID, '_tech', true );
		$priority = get_post_meta( $post->ID, '_priority', true );
		$date_in = get_post_meta( $post->ID, '_date_in', true );
		$eta = get_post_meta( $post->ID, '_eta', true );
		$failure = get_post_meta( $post->ID, '_failure', true );
		$stage_index = get_post_meta( $post->ID, '_stage_index', true );
		
		$stages = array( 'Intake', 'Teardown', 'Inspection', 'Parts', 'Rebuild', 'Spin Test', 'Painting', 'Complete' );
		$stage_name = isset( $stages[$stage_index] ) ? $stages[$stage_index] : $stage_index;

		echo '<div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
		echo '<p><strong>WO ID:</strong><br><input type="text" value="' . esc_attr( $wo_id ) . '" readonly style="width:100%; background:#f0f0f1; border:1px solid #ccd0d4; padding:5px;"/></p>';
		echo '<p><strong>Customer:</strong><br><input type="text" value="' . esc_attr( $customer ) . '" readonly style="width:100%; background:#f0f0f1; border:1px solid #ccd0d4; padding:5px;"/></p>';
		echo '<p><strong>Assigned Tech:</strong><br><input type="text" value="' . esc_attr( $tech ) . '" readonly style="width:100%; background:#f0f0f1; border:1px solid #ccd0d4; padding:5px;"/></p>';
		echo '<p><strong>Priority:</strong><br><input type="text" value="' . esc_attr( $priority ) . '" readonly style="width:100%; background:#f0f0f1; border:1px solid #ccd0d4; padding:5px;"/></p>';
		echo '<p><strong>Date In:</strong><br><input type="text" value="' . esc_attr( $date_in ) . '" readonly style="width:100%; background:#f0f0f1; border:1px solid #ccd0d4; padding:5px;"/></p>';
		echo '<p><strong>ETA:</strong><br><input type="text" value="' . esc_attr( $eta ) . '" readonly style="width:100%; background:#f0f0f1; border:1px solid #ccd0d4; padding:5px;"/></p>';
		echo '<p><strong>Current Stage:</strong><br><input type="text" value="' . esc_attr( $stage_name ) . '" readonly style="width:100%; background:#f0f0f1; border:1px solid #ccd0d4; padding:5px;"/></p>';
		
		$linked = get_post_meta( $post->ID, '_linked_customers', true );
		if ( ! empty( $linked ) && is_array( $linked ) ) {
			$names = array();
			foreach ( $linked as $uid ) {
				$u = get_userdata( (int) $uid );
				if ( $u ) {
					$names[] = esc_html( $u->display_name ) . ' (' . esc_html( $u->user_email ) . ')';
				}
			}
			$linked_str = implode( ', ', $names );
		} else {
			$linked_str = '— none —';
		}
		echo '<p><strong>Linked Customers:</strong><br><input type="text" value="' . esc_attr( $linked_str ) . '" readonly style="width:100%; background:#f0f0f1; border:1px solid #ccd0d4; padding:5px;"/></p>';
		echo '</div>';
		
		echo '<p><strong>Failure Description:</strong><br><textarea readonly style="width:100%; height:60px; background:#f0f0f1; border:1px solid #ccd0d4; padding:5px;">' . esc_textarea( $failure ) . '</textarea></p>';
		
		$checklist = json_decode( get_post_meta( $post->ID, '_checklist', true ), true );
		$notes = json_decode( get_post_meta( $post->ID, '_notes', true ), true );
		
		echo '<div style="margin-top: 20px; border-top: 1px solid #ccd0d4; padding-top: 15px;">';
		echo '<h4>Checklist Progress</h4>';
		if ( ! empty( $checklist ) && is_array( $checklist ) ) {
			echo '<div style="background:#f0f0f1; border:1px solid #ccd0d4; padding:10px; max-height:200px; overflow-y:auto;">';
			foreach ( $checklist as $group ) {
				echo '<strong style="display:block; margin-top:10px;">' . esc_html( $group['group'] ) . '</strong>';
				echo '<ul style="margin-top:5px; margin-bottom:10px;">';
				foreach ( $group['items'] as $item ) {
					$status = !empty( $item['done'] ) ? '<span style="color:green; font-weight:bold;">[✔]</span>' : '<span style="color:#999;">[ ]</span>';
					$meta = !empty( $item['done'] ) && !empty( $item['ts'] ) ? ' <em>(' . esc_html( $item['tech'] ) . ' - ' . wp_date( 'M j, Y H:i', $item['ts']/1000 ) . ')</em>' : '';
					echo '<li>' . $status . ' ' . esc_html( $item['label'] ) . $meta . '</li>';
				}
				echo '</ul>';
			}
			echo '</div>';
		} else {
			echo '<p style="color:#666;">No checklist data.</p>';
		}
		
		echo '<h4 style="margin-top:20px;">Notes & Shop Log</h4>';
		if ( ! empty( $notes ) && is_array( $notes ) ) {
			echo '<div style="background:#f0f0f1; border:1px solid #ccd0d4; padding:10px; max-height:200px; overflow-y:auto;">';
			foreach ( array_reverse( $notes ) as $note ) {
				$visibility = !empty( $note['customerVisible'] ) ? '<span style="background:#007cba; color:#fff; padding:2px 5px; border-radius:3px; font-size:10px; margin-left:5px;">Visible to Customer</span>' : '';
				echo '<div style="margin-bottom:10px; padding-bottom:10px; border-bottom:1px solid #ddd;">';
				echo '<div style="font-size:11px; color:#666; margin-bottom:3px;"><strong>' . esc_html( $note['tech'] ) . '</strong> &middot; ' . wp_date( 'M j, Y H:i', $note['ts']/1000 ) . $visibility . '</div>';
				echo '<div>' . nl2br( esc_html( $note['text'] ) ) . '</div>';
				echo '</div>';
			}
			echo '</div>';
		} else {
			echo '<p style="color:#666;">No notes yet.</p>';
		}
		echo '</div>';
		
		echo '<p style="margin-top:15px; color:#666;"><em>Note: These fields are read-only in the WordPress admin to maintain data integrity. Use the Mayday Gearbox Tracker frontend portal to properly update these values, notes, and stages.</em></p>';
	}

	public static function register_cpt() {
		$labels = array(
			'name'                  => 'Work Orders',
			'singular_name'         => 'Work Order',
			'menu_name'             => 'Work Orders',
			'name_admin_bar'        => 'Work Order',
			'add_new'               => 'Add New',
			'add_new_item'          => 'Add New Work Order',
			'new_item'              => 'New Work Order',
			'edit_item'             => 'Edit Work Order',
			'view_item'             => 'View Work Order',
			'all_items'             => 'All Work Orders',
			'search_items'          => 'Search Work Orders',
			'parent_item_colon'     => 'Parent Work Orders:',
			'not_found'             => 'No work orders found.',
			'not_found_in_trash'    => 'No work orders found in Trash.',
		);

		$args = array(
			'labels'             => $labels,
			'public'             => false, // Only accessed via API/Shortcodes
			'publicly_queryable' => false,
			'show_ui'            => true,
			'show_in_menu'       => true,
			'query_var'          => true,
			'rewrite'            => array( 'slug' => 'gearbox_job' ),
			'capability_type'    => 'post',
			'has_archive'        => false,
			'hierarchical'       => false,
			'menu_position'      => null,
			'menu_icon'          => 'dashicons-hammer',
			'supports'           => array( 'title', 'author' ),
			'show_in_rest'       => true,
		);

		register_post_type( 'gearbox_job', $args );
	}

	// ── Work Orders list table columns ──

	public static function set_job_columns( $columns ) {
		$new = array();
		$new['cb']              = $columns['cb'];
		$new['title']           = 'Gearbox Description';
		$new['wo_id']           = 'WO Number';
		$new['stage']           = 'Stage';
		$new['priority']        = 'Priority';
		$new['linked_customers']= 'Linked Customers';
		$new['date']            = $columns['date'];
		return $new;
	}

	public static function render_job_column( $column, $post_id ) {
		switch ( $column ) {
			case 'wo_id':
				echo esc_html( get_post_meta( $post_id, '_wo_id', true ) );
				break;
			case 'stage':
				$stages = array( 'Intake', 'Teardown', 'Inspection', 'Parts', 'Rebuild', 'Spin Test', 'Painting', 'Complete' );
				$idx = (int) get_post_meta( $post_id, '_stage_index', true );
				$name = isset( $stages[ $idx ] ) ? $stages[ $idx ] : $idx;
				$color = $idx >= 7 ? '#46b450' : '#ffb900';
				echo '<span style="padding:3px 8px;border-radius:3px;font-size:12px;font-weight:600;background:' . $color . '22;color:' . $color . ';border:1px solid ' . $color . ';">' . esc_html( $name ) . '</span>';
				break;
			case 'priority':
				$p = get_post_meta( $post_id, '_priority', true );
				$color = $p === 'Rush' ? '#dc3232' : ( $p === 'Urgent' ? '#ffb900' : '#72aee6' );
				echo '<span style="color:' . $color . ';font-weight:600;">' . esc_html( $p ) . '</span>';
				break;
			case 'linked_customers':
				$linked = get_post_meta( $post_id, '_linked_customers', true );
				if ( ! empty( $linked ) && is_array( $linked ) ) {
					$names = array();
					foreach ( $linked as $uid ) {
						$u = get_userdata( (int) $uid );
						if ( $u ) {
							$names[] = '<a href="' . esc_url( get_edit_user_link( $u->ID ) ) . '">' . esc_html( $u->display_name ) . '</a>';
						}
					}
					echo implode( ', ', $names );
				} else {
					echo '<span style="color:#999;">—</span>';
				}
				break;
		}
	}

	// ── Users list table column ──

	public static function set_user_columns( $columns ) {
		$columns['linked_jobs'] = 'Linked Work Orders';
		return $columns;
	}

	public static function render_user_column( $value, $column_name, $user_id ) {
		if ( $column_name !== 'linked_jobs' ) {
			return $value;
		}

		$linked = get_user_meta( $user_id, '_linked_jobs', true );
		if ( empty( $linked ) || ! is_array( $linked ) ) {
			return '<span style="color:#999;">—</span>';
		}

		$tags = array();
		foreach ( $linked as $post_id ) {
			$wo_id = get_post_meta( (int) $post_id, '_wo_id', true );
			if ( $wo_id ) {
				$tags[] = '<a href="' . esc_url( get_edit_post_link( $post_id ) ) . '">' . esc_html( $wo_id ) . '</a>';
			}
		}
		return implode( ', ', $tags );
	}
}
