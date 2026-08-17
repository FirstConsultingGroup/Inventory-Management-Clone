export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      store_access_config: {
        Row: {
          company_id: string
          created_at: string
          id: string
          locations: string[] | null
          role_id: string | null
          stores: string[] | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          locations?: string[] | null
          role_id?: string | null
          stores?: string[] | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          locations?: string[] | null
          role_id?: string | null
          stores?: string[] | null
        }
        Relationships: []
      }
      available_actions: {
        Row: {
          action_name: string | null
          created_at: string
          id: string
        }
        Insert: {
          action_name?: string | null
          created_at?: string
          id?: string
        }
        Update: {
          action_name?: string | null
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      available_submodules: {
        Row: {
          created_at: string
          id: string
          submodule_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          submodule_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          submodule_name?: string | null
        }
        Relationships: []
      }
      authorization_workflows: {
        Row: {
          action_id: string | null
          created_at: string
          id: string
          module_id: string | null
        }
        Insert: {
          action_id?: string | null
          created_at?: string
          id?: string
          module_id?: string | null
        }
        Update: {
          action_id?: string | null
          created_at?: string
          id?: string
          module_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "authorization_workflows_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "available_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_workflows_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "main_modules"
            referencedColumns: ["id"]
          }
        ]
      }
      category_master: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          modified_at: string | null
          name: string | null
          status: boolean | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          modified_at?: string | null
          name?: string | null
          status?: boolean | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          modified_at?: string | null
          name?: string | null
          status?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "category_master_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
        ]
      }
      client_integrations: {
        Row: {
          access_key: string | null
          company_id: string | null
          created_at: string
          id: string
          user_id: string | null
        }
        Insert: {
          access_key?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Update: {
          access_key?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_mgmt"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_master: {
        Row: {
          company_id: string | null
          created_at: string
          display_name: string | null
          id: string
          table_name: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          table_name?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          table_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_master_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
        ]
      }
      company_master: {
        Row: {
          address: string | null
          bank_account_number: string | null
          bank_name: string | null
          city: string | null
          country: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          email: string | null
          employee_id_config: Json | null
          iban_code: string | null
          id: string
          ifsc_code: string | null
          is_active: boolean | null
          modified_at: string | null
          name: string
          phone: string | null
          postal_code: string | null
          state: string | null
          tax_percentage: number | null
        }
        Insert: {
          address?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          email?: string | null
          employee_id_config?: Json | null
          iban_code?: string | null
          id?: string
          ifsc_code?: string | null
          is_active?: boolean | null
          modified_at?: string | null
          name: string
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          tax_percentage?: number | null
        }
        Update: {
          address?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          email?: string | null
          employee_id_config?: Json | null
          iban_code?: string | null
          id?: string
          ifsc_code?: string | null
          is_active?: boolean | null
          modified_at?: string | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          tax_percentage?: number | null
        }
        Relationships: []
      }
      customer_mgmt: {
        Row: {
          address: string
          company_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          email: string | null
          fullname: string
          id: string
          is_active: boolean | null
          modified_at: string | null
          modified_by: string | null
          notes: string | null
          notifications: boolean
          phone: string | null
          status: boolean
          type: string
        }
        Insert: {
          address: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          email?: string | null
          fullname: string
          id?: string
          is_active?: boolean | null
          modified_at?: string | null
          modified_by?: string | null
          notes?: string | null
          notifications: boolean
          phone?: string | null
          status: boolean
          type: string
        }
        Update: {
          address?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          email?: string | null
          fullname?: string
          id?: string
          is_active?: boolean | null
          modified_at?: string | null
          modified_by?: string | null
          notes?: string | null
          notifications?: boolean
          phone?: string | null
          status?: boolean
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_mgmt_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
        ]
      }
      department_master: {
        Row: {
          company_id: string
          created_at: string | null
          department_id: string
          department_name: string
          id: string
          info: string | null
          is_active: boolean | null
          modified_at: string | null
          status: boolean
        }
        Insert: {
          company_id: string
          created_at?: string | null
          department_id: string
          department_name: string
          id?: string
          info?: string | null
          is_active?: boolean | null
          modified_at?: string | null
          status?: boolean
        }
        Update: {
          company_id?: string
          created_at?: string | null
          department_id?: string
          department_name?: string
          id?: string
          info?: string | null
          is_active?: boolean | null
          modified_at?: string | null
          status?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "department_master_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
        ]
      }
      global_discount: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          is_active: boolean | null
          label: string | null
          value: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          label?: string | null
          value?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          label?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "global_discount_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_loc_master: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          loc_type: string
          short_name: string
          store_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          loc_type: string
          short_name: string
          store_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          loc_type?: string
          short_name?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_loc_master_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_loc_master_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_mgmt"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_loc_mgmt: {
        Row: {
          cabinet_id: string | null
          company_id: string | null
          created_at: string
          id: string
          shelf_id: string | null
          store_Id: string | null
        }
        Insert: {
          cabinet_id?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          shelf_id?: string | null
          store_Id?: string | null
        }
        Update: {
          cabinet_id?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          shelf_id?: string | null
          store_Id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_loc_mgmt_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "inventory_loc_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_loc_mgmt_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_loc_mgmt_shelf_id_fkey"
            columns: ["shelf_id"]
            isOneToOne: false
            referencedRelation: "inventory_loc_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_loc_mgmt_store_Id_fkey"
            columns: ["store_Id"]
            isOneToOne: false
            referencedRelation: "store_mgmt"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_mgmt: {
        Row: {
          company_id: string | null
          created_at: string
          expiry_date: string | null
          id: string
          item_id: string | null
          item_qty: number | null
          link_loc: string | null
          purchase_order_id: string | null
          selling_price: number | null
          stock_date: string | null
          store_id: string | null
          unit_price: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          item_id?: string | null
          item_qty?: number | null
          link_loc?: string | null
          purchase_order_id?: string | null
          selling_price?: number | null
          stock_date?: string | null
          store_id?: string | null
          unit_price?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          item_id?: string | null
          item_qty?: number | null
          link_loc?: string | null
          purchase_order_id?: string | null
          selling_price?: number | null
          stock_date?: string | null
          store_id?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_mgmt_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_mgmt_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_mgmt_link_loc_fkey"
            columns: ["link_loc"]
            isOneToOne: false
            referencedRelation: "inventory_loc_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_mgmt_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_mgmt_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_mgmt"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transfer: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          destination_inv_loc: string | null
          destination_store_id: string
          id: string
          item_id: string
          notes: string | null
          orgin_store_id: string
          origin_inv_loc: string | null
          transfer_date: string
          transfer_qty: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          destination_inv_loc?: string | null
          destination_store_id: string
          id?: string
          item_id?: string
          notes?: string | null
          orgin_store_id: string
          origin_inv_loc?: string | null
          transfer_date: string
          transfer_qty: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          destination_inv_loc?: string | null
          destination_store_id?: string
          id?: string
          item_id?: string
          notes?: string | null
          orgin_store_id?: string
          origin_inv_loc?: string | null
          transfer_date?: string
          transfer_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transfer_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfer_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfer_destination_inv_loc_fkey"
            columns: ["destination_inv_loc"]
            isOneToOne: false
            referencedRelation: "inventory_loc_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfer_destination_store_id_fkey"
            columns: ["destination_store_id"]
            isOneToOne: false
            referencedRelation: "store_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfer_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfer_orgin_store_id_fkey"
            columns: ["orgin_store_id"]
            isOneToOne: false
            referencedRelation: "store_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfer_origin_inv_loc_fkey"
            columns: ["origin_inv_loc"]
            isOneToOne: false
            referencedRelation: "inventory_loc_mgmt"
            referencedColumns: ["id"]
          },
        ]
      }
      item_configurator: {
        Row: {
          collection_id: string | null
          company_id: string | null
          control_type: string
          created_at: string | null
          data_type: string | null
          description: string | null
          id: string
          is_mandatory: boolean | null
          item_unit_id: string | null
          max_length: number | null
          modified_at: string | null
          name: string
          sequence: number
        }
        Insert: {
          collection_id?: string | null
          company_id?: string | null
          control_type: string
          created_at?: string | null
          data_type?: string | null
          description?: string | null
          id?: string
          is_mandatory?: boolean | null
          item_unit_id?: string | null
          max_length?: number | null
          modified_at?: string | null
          name: string
          sequence: number
        }
        Update: {
          collection_id?: string | null
          company_id?: string | null
          control_type?: string
          created_at?: string | null
          data_type?: string | null
          description?: string | null
          id?: string
          is_mandatory?: boolean | null
          item_unit_id?: string | null
          max_length?: number | null
          modified_at?: string | null
          name?: string
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "item_configurator_collection_id_fkey1"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "item_lookup_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_configurator_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_configurator_item_unit_id_fkey"
            columns: ["item_unit_id"]
            isOneToOne: false
            referencedRelation: "units_master"
            referencedColumns: ["id"]
          },
        ]
      }
      item_lookup_master: {
        Row: {
          alias_name: string | null
          company_id: string | null
          created_at: string
          id: string
          key: string | null
          order: number | null
          type: string | null
          value: string | null
        }
        Insert: {
          alias_name?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          key?: string | null
          order?: number | null
          type?: string | null
          value?: string | null
        }
        Update: {
          alias_name?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          key?: string | null
          order?: number | null
          type?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_lookup_master_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
        ]
      }
      item_mgmt: {
        Row: {
          addtional_attributes: Json | null
          alternative_items_list: Json | null
          category_id: string | null
          category_type: string | null
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          image: Json | null
          is_active: boolean | null
          is_temporary: boolean | null
          item_id: string | null
          item_name: string
          max_level: number | null
          reorder_level: number | null
          selling_price: number | null
          tax_percentage: Json | null
          video: Json | null
          youtube_link: string | null
        }
        Insert: {
          addtional_attributes?: Json | null
          alternative_items_list?: Json | null
          category_id?: string | null
          category_type?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image?: Json | null
          is_active?: boolean | null
          is_temporary?: boolean | null
          item_id?: string | null
          item_name: string
          max_level?: number | null
          reorder_level?: number | null
          selling_price?: number | null
          tax_percentage?: Json | null
          video?: Json | null
          youtube_link?: string | null
        }
        Update: {
          addtional_attributes?: Json | null
          alternative_items_list?: Json | null
          category_id?: string | null
          category_type?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image?: Json | null
          is_active?: boolean | null
          is_temporary?: boolean | null
          item_id?: string | null
          item_name?: string
          max_level?: number | null
          reorder_level?: number | null
          selling_price?: number | null
          tax_percentage?: Json | null
          video?: Json | null
          youtube_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_mgmt_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_mgmt_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
        ]
      }
      item_operations: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          is_active: boolean | null
          item_id: string | null
          note: string | null
          snooze_until: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          item_id?: string | null
          note?: string | null
          snooze_until?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          item_id?: string | null
          note?: string | null
          snooze_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_operations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_operations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_mgmt"
            referencedColumns: ["id"]
          },
        ]
      }
      location_master: {
        Row: {
          additional_info: string | null
          company_id: string | null
          created_at: string
          id: string
          is_active: boolean | null
          location_id: string | null
          location_name: string | null
          status: boolean | null
        }
        Insert: {
          additional_info?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          location_id?: string | null
          location_name?: string | null
          status?: boolean | null
        }
        Update: {
          additional_info?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          location_id?: string | null
          location_name?: string | null
          status?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "location_master_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
        ]
      }
      main_modules: {
        Row: {
          available_actions: Json | null
          created_at: string
          id: string
          is_store_specific: boolean | null
          module_key: string | null
          module_name: string | null
          module_route: string | null
          parent_id: string | null
          selected_submodules: Json | null
        }
        Insert: {
          available_actions?: Json | null
          created_at?: string
          id?: string
          is_store_specific?: boolean | null
          module_key?: string | null
          module_name?: string | null
          module_route?: string | null
          parent_id?: string | null
          selected_submodules?: Json | null
        }
        Update: {
          available_actions?: Json | null
          created_at?: string
          id?: string
          is_store_specific?: boolean | null
          module_key?: string | null
          module_name?: string | null
          module_route?: string | null
          parent_id?: string | null
          selected_submodules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "main_modules_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parent_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_modules: {
        Row: {
          created_at: string
          id: string
          module_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          module_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          module_name?: string | null
        }
        Relationships: []
      }
      purchase_order: {
        Row: {
          approval_status: Json | null
          backorder_reference: string | null
          cancelled_by: string | null
          cancelled_on: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          id: string
          is_active: boolean | null
          issued_by: string | null
          issued_on: string | null
          modified_at: string | null
          modified_by: string | null
          next_level_role_id: string | null
          order_date: string
          order_status: string | null
          payment_details: string | null
          po_number: string | null
          received_by: string | null
          received_on: string | null
          received_qty: number | null
          remarks: string | null
          selected_reason: string | null
          store_id: string | null
          supplier_id: string | null
          total_items: number | null
          total_value: number | null
          workflow_id: string | null
        }
        Insert: {
          approval_status?: Json | null
          backorder_reference?: string | null
          cancelled_by?: string | null
          cancelled_on?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          is_active?: boolean | null
          issued_by?: string | null
          issued_on?: string | null
          modified_at?: string | null
          modified_by?: string | null
          next_level_role_id?: string | null
          order_date: string
          order_status?: string | null
          payment_details?: string | null
          po_number?: string | null
          received_by?: string | null
          received_on?: string | null
          received_qty?: number | null
          remarks?: string | null
          selected_reason?: string | null
          store_id?: string | null
          supplier_id?: string | null
          total_items?: number | null
          total_value?: number | null
          workflow_id?: string | null
        }
        Update: {
          approval_status?: Json | null
          backorder_reference?: string | null
          cancelled_by?: string | null
          cancelled_on?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          is_active?: boolean | null
          issued_by?: string | null
          issued_on?: string | null
          modified_at?: string | null
          modified_by?: string | null
          next_level_role_id?: string | null
          order_date?: string
          order_status?: string | null
          payment_details?: string | null
          po_number?: string | null
          received_by?: string | null
          received_on?: string | null
          received_qty?: number | null
          remarks?: string | null
          selected_reason?: string | null
          store_id?: string | null
          supplier_id?: string | null
          total_items?: number | null
          total_value?: number | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_backorder_reference_fkey"
            columns: ["backorder_reference"]
            isOneToOne: false
            referencedRelation: "purchase_order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "user_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "user_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_modified_by_fkey"
            columns: ["modified_by"]
            isOneToOne: false
            referencedRelation: "user_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_next_level_role_id_fkey"
            columns: ["next_level_role_id"]
            isOneToOne: false
            referencedRelation: "role_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_order_status_fkey"
            columns: ["order_status"]
            isOneToOne: false
            referencedRelation: "system_message_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "user_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_config"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          is_active: boolean | null
          item_id: string
          modified_at: string | null
          order_price: number | null
          order_qty: number | null
          purchase_order_id: string
          received_qty: number | null
          remarks: string | null
          returned_qty: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          item_id: string
          modified_at?: string | null
          order_price?: number | null
          order_qty?: number | null
          purchase_order_id: string
          received_qty?: number | null
          remarks?: string | null
          returned_qty?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          item_id?: string
          modified_at?: string | null
          order_price?: number | null
          order_qty?: number | null
          purchase_order_id?: string
          received_qty?: number | null
          remarks?: string | null
          returned_qty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_order"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_req_details: {
        Row: {
          company_id: string
          created_at: string
          id: string
          item_id: string
          purchase_req_id: string
          req_qty: number | null
          issued_qty: number | null
          remaining_qty: number | null
          status: string | null
          issue_history: Json | null
          cancel_history: Json | null
          cancelled_qty: number | null
          source_locations: Json | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          id?: string
          item_id?: string
          purchase_req_id: string
          req_qty?: number | null
          issued_qty?: number | null
          remaining_qty?: number | null
          status?: string | null
          issue_history?: Json | null
          cancel_history?: Json | null
          cancelled_qty?: number | null
          source_locations?: Json | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          item_id?: string
          purchase_req_id?: string
          req_qty?: number | null
          issued_qty?: number | null
          remaining_qty?: number | null
          status?: string | null
          issue_history?: Json | null
          cancel_history?: Json | null
          cancelled_qty?: number | null
          source_locations?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_req_details_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_req_details_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_req_details_purchase_req_id_fkey"
            columns: ["purchase_req_id"]
            isOneToOne: false
            referencedRelation: "purchase_req_master"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_req_master: {
        Row: {
          approval_status: Json | null
          category_id: string | null
          category_type: string | null
          company_id: string
          created_at: string
          created_by: string | null
          department_id: string | null
          id: string
          next_level_role_id: string | null
          procurement_status: string | null
          purchase_req_date: string
          purchase_req_number: string
          required_by_date: string | null
          status: string | null
          store_id: string | null
          total_items: number | null
          workflow_id: string | null
        }
        Insert: {
          approval_status?: Json | null
          category_id?: string | null
          category_type?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          next_level_role_id?: string | null
          procurement_status?: string | null
          purchase_req_date: string
          purchase_req_number: string
          required_by_date?: string | null
          status?: string | null
          store_id?: string | null
          total_items?: number | null
          workflow_id?: string | null
        }
        Update: {
          approval_status?: Json | null
          category_id?: string | null
          category_type?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          next_level_role_id?: string | null
          procurement_status?: string | null
          purchase_req_date?: string
          purchase_req_number?: string
          required_by_date?: string | null
          status?: string | null
          store_id?: string | null
          total_items?: number | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_req_master_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_req_master_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_req_master_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_req_master_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_req_master_next_level_role_id_fkey"
            columns: ["next_level_role_id"]
            isOneToOne: false
            referencedRelation: "role_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_req_master_status_fkey"
            columns: ["status"]
            isOneToOne: false
            referencedRelation: "system_message_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_req_master_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_req_master_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_config"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_return: {
        Row: {
          approval_status: Json | null
          attachment: Json | null
          company_id: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          id: string
          is_active: boolean | null
          modified_at: string | null
          next_level_role_id: string | null
          purchase_order_id: string | null
          purchase_retrun_number: string
          remark: string | null
          return_date: string
          return_status: string | null
          store_id: string | null
          supplier_id: string
          total_items: number | null
          total_value: number | null
          workflow_id: string | null
        }
        Insert: {
          approval_status?: Json | null
          attachment?: Json | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          is_active?: boolean | null
          modified_at?: string | null
          next_level_role_id?: string | null
          purchase_order_id?: string | null
          purchase_retrun_number: string
          remark?: string | null
          return_date: string
          return_status?: string | null
          store_id?: string | null
          supplier_id?: string
          total_items?: number | null
          total_value?: number | null
          workflow_id?: string | null
        }
        Update: {
          approval_status?: Json | null
          attachment?: Json | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          is_active?: boolean | null
          modified_at?: string | null
          next_level_role_id?: string | null
          purchase_order_id?: string | null
          purchase_retrun_number?: string
          remark?: string | null
          return_date?: string
          return_status?: string | null
          store_id?: string | null
          supplier_id?: string
          total_items?: number | null
          total_value?: number | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_return_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_next_level_role_id_fkey"
            columns: ["next_level_role_id"]
            isOneToOne: false
            referencedRelation: "role_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_return_status_fkey"
            columns: ["return_status"]
            isOneToOne: false
            referencedRelation: "system_message_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_config"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_return_items: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          is_active: boolean | null
          item_id: string
          order_price: number | null
          purchase_return_id: string
          remarks: string | null
          return_reason: string | null
          returned_qty: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          item_id?: string
          order_price?: number | null
          purchase_return_id?: string
          remarks?: string | null
          return_reason?: string | null
          returned_qty: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          item_id?: string
          order_price?: number | null
          purchase_return_id?: string
          remarks?: string | null
          return_reason?: string | null
          returned_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_return_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_reurn_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_reurn_items_purchase_return_id_fkey"
            columns: ["purchase_return_id"]
            isOneToOne: false
            referencedRelation: "purchase_return"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_details: {
        Row: {
          company_id: string | null
          cost_price: number | null
          created_at: string
          id: string
          item_id: string
          quotation_id: string
          req_qty: number | null
        }
        Insert: {
          company_id?: string | null
          cost_price?: number | null
          created_at?: string
          id?: string
          item_id?: string
          quotation_id: string
          req_qty?: number | null
        }
        Update: {
          company_id?: string | null
          cost_price?: number | null
          created_at?: string
          id?: string
          item_id?: string
          quotation_id?: string
          req_qty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotation_details_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_details_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_details_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotation_master"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_master: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string
          id: string
          quotation_date: string
          quotation_number: string
          status: string | null
          supplier_id: string
          total_items: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          quotation_date: string
          quotation_number: string
          status?: string | null
          supplier_id?: string
          total_items?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          quotation_date?: string
          quotation_number?: string
          status?: string | null
          supplier_id?: string
          total_items?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotation_master_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_master_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_master_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_mgmt"
            referencedColumns: ["id"]
          },
        ]
      }
      report_config: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          report_category: string | null
          report_config_key: string | null
          report_config_value: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          report_category?: string | null
          report_config_key?: string | null
          report_config_value?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          report_category?: string | null
          report_config_key?: string | null
          report_config_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
        ]
      }
      role_master: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string | null
          role_id: string | null
          status: boolean | null
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          role_id?: string | null
          status?: boolean | null
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          role_id?: string | null
          status?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "role_master_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
        ]
      }
      role_module_permissions: {
        Row: {
          allowed: boolean
          company_id: string | null
          created_at: string | null
          id: string
          module_key: string
          role_id: string
          sub_modules: Json | null
          updated_at: string | null
        }
        Insert: {
          allowed?: boolean
          company_id?: string | null
          created_at?: string | null
          id?: string
          module_key: string
          role_id: string
          sub_modules?: Json | null
          updated_at?: string | null
        }
        Update: {
          allowed?: boolean
          company_id?: string | null
          created_at?: string | null
          id?: string
          module_key?: string
          role_id?: string
          sub_modules?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_module_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_module_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "role_master"
            referencedColumns: ["id"]
          },
        ]
      }
      role_module_permissions_clone: {
        Row: {
          allowed: boolean | null
          company_id: string
          created_at: string | null
          department_id: string | null
          id: string
          module_key: string
          role_id: string
          store_id: string | null
          sub_modules: Json | null
          updated_at: string | null
        }
        Insert: {
          allowed?: boolean | null
          company_id: string
          created_at?: string | null
          department_id?: string | null
          id?: string
          module_key: string
          role_id: string
          store_id?: string | null
          sub_modules?: Json | null
          updated_at?: string | null
        }
        Update: {
          allowed?: boolean | null
          company_id?: string
          created_at?: string | null
          department_id?: string | null
          id?: string
          module_key?: string
          role_id?: string
          store_id?: string | null
          sub_modules?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_module_permissions_clone_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_module_permissions_clone_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_module_permissions_clone_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "role_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_module_permissions_clone_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_mgmt"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoice: {
        Row: {
          billing_address: string | null
          company_id: string | null
          contact_number: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          discount_amount: number | null
          email: string | null
          freight_charges: number | null
          id: string
          invoice_amount: number | null
          invoice_date: string | null
          invoice_number: string | null
          net_amount: number | null
          payment_mode: string | null
          store_id: string | null
          tax_amount: number | null
          total_discount_amount: number | null
          total_discount_percentage: number | null
          total_items: number | null
          transaction_id: string | null
        }
        Insert: {
          billing_address?: string | null
          company_id?: string | null
          contact_number?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          discount_amount?: number | null
          email?: string | null
          freight_charges?: number | null
          id?: string
          invoice_amount?: number | null
          invoice_date?: string | null
          invoice_number?: string | null
          net_amount?: number | null
          payment_mode?: string | null
          store_id?: string | null
          tax_amount?: number | null
          total_discount_amount?: number | null
          total_discount_percentage?: number | null
          total_items?: number | null
          transaction_id?: string | null
        }
        Update: {
          billing_address?: string | null
          company_id?: string | null
          contact_number?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          discount_amount?: number | null
          email?: string | null
          freight_charges?: number | null
          id?: string
          invoice_amount?: number | null
          invoice_date?: string | null
          invoice_number?: string | null
          net_amount?: number | null
          payment_mode?: string | null
          store_id?: string | null
          tax_amount?: number | null
          total_discount_amount?: number | null
          total_discount_percentage?: number | null
          total_items?: number | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoice_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_mgmt"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoice_items: {
        Row: {
          company_id: string | null
          created_at: string
          discount_percentage: number | null
          id: string
          item_id: string
          loc_id: Json | null
          quantity: number | null
          sales_invoice_id: string
          tax_percentage: Json | null
          unit_price: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          discount_percentage?: number | null
          id?: string
          item_id?: string
          loc_id?: Json | null
          quantity?: number | null
          sales_invoice_id?: string
          tax_percentage?: Json | null
          unit_price?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          discount_percentage?: number | null
          id?: string
          item_id?: string
          loc_id?: Json | null
          quantity?: number | null
          sales_invoice_id?: string
          tax_percentage?: Json | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoice_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_items_sales_invoice_id_fkey"
            columns: ["sales_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoice"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_return: {
        Row: {
          approval_status: Json | null
          attachment: Json | null
          company_id: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          id: string
          linked_invoice_id: string | null
          next_level_role_id: string | null
          remarks: string | null
          return_date: string | null
          return_status: string | null
          sales_return_number: string | null
          store_id: string | null
          total_items: number | null
          workflow_id: string | null
        }
        Insert: {
          approval_status?: Json | null
          attachment?: Json | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          linked_invoice_id?: string | null
          next_level_role_id?: string | null
          remarks?: string | null
          return_date?: string | null
          return_status?: string | null
          sales_return_number?: string | null
          store_id?: string | null
          total_items?: number | null
          workflow_id?: string | null
        }
        Update: {
          approval_status?: Json | null
          attachment?: Json | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          linked_invoice_id?: string | null
          next_level_role_id?: string | null
          remarks?: string | null
          return_date?: string | null
          return_status?: string | null
          sales_return_number?: string | null
          store_id?: string | null
          total_items?: number | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_return_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_linked_invoice_id_fkey"
            columns: ["linked_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_next_level_role_id_fkey"
            columns: ["next_level_role_id"]
            isOneToOne: false
            referencedRelation: "role_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_return_status_fkey"
            columns: ["return_status"]
            isOneToOne: false
            referencedRelation: "system_message_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_config"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_return_items: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          item_id: string | null
          next_store_id: string | null
          return_reason: string | null
          returned_qty: number | null
          sales_return_id: string | null
          storage_location_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          item_id?: string | null
          next_store_id?: string | null
          return_reason?: string | null
          returned_qty?: number | null
          sales_return_id?: string | null
          storage_location_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          item_id?: string | null
          next_store_id?: string | null
          return_reason?: string | null
          returned_qty?: number | null
          sales_return_id?: string | null
          storage_location_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_return_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_items_next_store_id_fkey"
            columns: ["next_store_id"]
            isOneToOne: false
            referencedRelation: "store_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_items_sales_return_id_fkey"
            columns: ["sales_return_id"]
            isOneToOne: false
            referencedRelation: "sales_return"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_items_storage_location_id_fkey"
            columns: ["storage_location_id"]
            isOneToOne: false
            referencedRelation: "inventory_loc_mgmt"
            referencedColumns: ["id"]
          },
        ]
      }
      store_mgmt: {
        Row: {
          address: string | null
          bank_account_number: string | null
          bank_name: string | null
          bank_primary_code: string | null
          bank_secondary_code: string | null
          city: string | null
          code: string | null
          company_id: string
          country: string | null
          created_at: string
          direct_purchase_allowed: boolean | null
          email: string | null
          external: boolean | null
          id: string
          internal: boolean | null
          is_active: boolean | null
          location_id: string | null
          modified_at: string | null
          name: string
          parent_id: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          store_manager_id: string | null
          tax_code: string | null
          type: string
        }
        Insert: {
          address?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          bank_primary_code?: string | null
          bank_secondary_code?: string | null
          city?: string | null
          code?: string | null
          company_id: string
          country?: string | null
          created_at: string
          direct_purchase_allowed?: boolean | null
          email?: string | null
          external?: boolean | null
          id?: string
          internal?: boolean | null
          is_active?: boolean | null
          location_id?: string | null
          modified_at?: string | null
          name: string
          parent_id?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          store_manager_id?: string | null
          tax_code?: string | null
          type: string
        }
        Update: {
          address?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          bank_primary_code?: string | null
          bank_secondary_code?: string | null
          city?: string | null
          code?: string | null
          company_id?: string
          country?: string | null
          created_at?: string
          direct_purchase_allowed?: boolean | null
          email?: string | null
          external?: boolean | null
          id?: string
          internal?: boolean | null
          is_active?: boolean | null
          location_id?: string | null
          modified_at?: string | null
          name?: string
          parent_id?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          store_manager_id?: string | null
          tax_code?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_mgmt_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_mgmt_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_mgmt_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "store_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_mgmt_store_manager_id_fkey"
            columns: ["store_manager_id"]
            isOneToOne: false
            referencedRelation: "user_mgmt"
            referencedColumns: ["id"]
          },
        ]
      }
      store_stock_levels: {
        Row: {
          available_qty: number | null
          created_at: string | null
          id: string
          item_id: string | null
          store_id: string | null
        }
        Insert: {
          available_qty?: number | null
          created_at?: string | null
          id?: string
          item_id?: string | null
          store_id?: string | null
        }
        Update: {
          available_qty?: number | null
          created_at?: string | null
          id?: string
          item_id?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_stock_levels_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_stock_levels_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_mgmt"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_items: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          is_active: boolean | null
          item_id: string | null
          supplier_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          item_id?: string | null
          supplier_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          item_id?: string | null
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_mgmt"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_mgmt: {
        Row: {
          address: string | null
          bank_account_number: string | null
          bank_name: string | null
          city: string | null
          company_id: string | null
          contact_person: string | null
          country: string | null
          created_at: string
          credit_limit: number | null
          email: string | null
          iban_code: string | null
          id: string
          ifsc_code: string | null
          is_active: boolean | null
          modified_at: string | null
          notes: string | null
          payment_terms: string | null
          phone: string | null
          postal_code: string | null
          rating: number | null
          registration_number: string | null
          state: string | null
          status: string | null
          supplier_id: string
          supplier_info: string | null
          supplier_name: string | null
          tax_id: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          city?: string | null
          company_id?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          credit_limit?: number | null
          email?: string | null
          iban_code?: string | null
          id?: string
          ifsc_code?: string | null
          is_active?: boolean | null
          modified_at?: string | null
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          postal_code?: string | null
          rating?: number | null
          registration_number?: string | null
          state?: string | null
          status?: string | null
          supplier_id: string
          supplier_info?: string | null
          supplier_name?: string | null
          tax_id?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          city?: string | null
          company_id?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          credit_limit?: number | null
          email?: string | null
          iban_code?: string | null
          id?: string
          ifsc_code?: string | null
          is_active?: boolean | null
          modified_at?: string | null
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          postal_code?: string | null
          rating?: number | null
          registration_number?: string | null
          state?: string | null
          status?: string | null
          supplier_id?: string
          supplier_info?: string | null
          supplier_name?: string | null
          tax_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_mgmt_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
        ]
      }
      system_log: {
        Row: {
          action_by: string | null
          company_id: string | null
          created_at: string
          id: string
          key: string | null
          log: string | null
          module: string | null
          scope: string | null
          transaction_date: string
        }
        Insert: {
          action_by?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          key?: string | null
          log?: string | null
          module?: string | null
          scope?: string | null
          transaction_date: string
        }
        Update: {
          action_by?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          key?: string | null
          log?: string | null
          module?: string | null
          scope?: string | null
          transaction_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_log_action_by_fkey"
            columns: ["action_by"]
            isOneToOne: false
            referencedRelation: "user_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
        ]
      }
      system_message_config: {
        Row: {
          category_id: string
          company_id: string
          created_at: string
          id: string
          sub_category_id: string
          value: string | null
        }
        Insert: {
          category_id: string
          company_id?: string
          created_at?: string
          id?: string
          sub_category_id: string
          value?: string | null
        }
        Update: {
          category_id?: string
          company_id?: string
          created_at?: string
          id?: string
          sub_category_id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_message_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
        ]
      }
      system_notification: {
        Row: {
          acknowledged_at: string | null
          alert_type: string
          assign_to: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          entity_id: string | null
          expiry_date: string | null
          id: string
          is_active: boolean | null
          message: string
          priority: string
          status: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          alert_type: string
          assign_to?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          expiry_date?: string | null
          id?: string
          is_active?: boolean | null
          message: string
          priority: string
          status?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          alert_type?: string
          assign_to?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          expiry_date?: string | null
          id?: string
          is_active?: boolean | null
          message?: string
          priority?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_notification_assign_to_fkey"
            columns: ["assign_to"]
            isOneToOne: false
            referencedRelation: "user_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_notification_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_notification_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_mgmt"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          company_email: string | null
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          system_config_key: string | null
          system_config_value: string | null
        }
        Insert: {
          company_email?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          system_config_key?: string | null
          system_config_value?: string | null
        }
        Update: {
          company_email?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          system_config_key?: string | null
          system_config_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_master: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          is_active: boolean | null
          label: string | null
          value: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          label?: string | null
          value?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          label?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_master_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
        ]
      }
      units_master: {
        Row: {
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          modified_at: string | null
          name: string
          short_name: string | null
          unit_quantity: number
        }
        Insert: {
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          modified_at?: string | null
          name: string
          short_name?: string | null
          unit_quantity: number
        }
        Update: {
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          modified_at?: string | null
          name?: string
          short_name?: string | null
          unit_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "units_master_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
        ]
      }
      user_mgmt: {
        Row: {
          approve_authorizations: Json | null
          authorization: Json | null
          company_id: string
          created_at: string
          department_id: string | null
          email: string | null
          employee_id: string | null
          employee_location_id: string | null
          failed_attempts: number | null
          first_name: string | null
          id: string
          image: Json | null
          is_active: boolean | null
          last_login_date: string | null
          last_name: string | null
          locations: string[] | null
          stores: string[] | null
          store_access_override: boolean | null
          modified_at: string | null
          role_id: string | null
          secret_answer: string | null
          security_question: string | null
          status: string | null
        }
        Insert: {
          approve_authorizations?: Json | null
          authorization?: Json | null
          company_id: string
          created_at: string
          department_id?: string | null
          email?: string | null
          employee_id?: string | null
          employee_location_id?: string | null
          failed_attempts?: number | null
          first_name?: string | null
          id: string
          image?: Json | null
          is_active?: boolean | null
          last_login_date?: string | null
          last_name?: string | null
          locations?: string[] | null
          stores?: string[] | null
          store_access_override?: boolean | null
          modified_at?: string | null
          role_id?: string | null
          secret_answer?: string | null
          security_question?: string | null
          status?: string | null
        }
        Update: {
          approve_authorizations?: Json | null
          authorization?: Json | null
          company_id?: string
          created_at?: string
          department_id?: string | null
          email?: string | null
          employee_id?: string | null
          employee_location_id?: string | null
          failed_attempts?: number | null
          first_name?: string | null
          id?: string
          image?: Json | null
          is_active?: boolean | null
          last_login_date?: string | null
          last_name?: string | null
          locations?: string[] | null
          stores?: string[] | null
          store_access_override?: boolean | null
          modified_at?: string | null
          role_id?: string | null
          secret_answer?: string | null
          security_question?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_mgmt_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_mgmt_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_mgmt_employee_location_id_fkey"
            columns: ["employee_location_id"]
            isOneToOne: false
            referencedRelation: "location_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_mgmt_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "role_master"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_config: {
        Row: {
          approval_users: Json | null
          company_id: string | null
          created_at: string
          created_by: string
          full_rejection_enabled: boolean | null
          id: string
          is_active: boolean | null
          level: number
          modified_at: string | null
          modified_by: string | null
          multiple_approvers_enabled: boolean | null
          override_enabled: boolean | null
          assigned_to: string | null
          module_id: string | null
          action_id: string | null
          role_id: string
          store_id: string | null
          target_role_id: string | null
          scope_level: string | null
          status: boolean | null
          stores: Json | null
        }
        Insert: {
          approval_users?: Json | null
          company_id?: string | null
          created_at?: string
          created_by: string
          full_rejection_enabled?: boolean | null
          id?: string
          is_active?: boolean | null
          level: number
          modified_at?: string | null
          modified_by?: string | null
          multiple_approvers_enabled?: boolean | null
          override_enabled?: boolean | null
          assigned_to?: string | null
          module_id?: string | null
          action_id?: string | null
          role_id?: string
          store_id?: string | null
          target_role_id?: string | null
          scope_level?: string | null
          status?: boolean | null
          stores?: Json | null
        }
        Update: {
          approval_users?: Json | null
          company_id?: string | null
          created_at?: string
          created_by?: string
          full_rejection_enabled?: boolean | null
          id?: string
          is_active?: boolean | null
          level?: number
          modified_at?: string | null
          modified_by?: string | null
          multiple_approvers_enabled?: boolean | null
          override_enabled?: boolean | null
          assigned_to?: string | null
          module_id?: string | null
          action_id?: string | null
          role_id?: string
          store_id?: string | null
          target_role_id?: string | null
          scope_level?: string | null
          status?: boolean | null
          stores?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_config_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_mgmt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_config_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "role_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_config_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_mgmt"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      filtered_purchase_orders: {
        Row: {
          po_number: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      bulk_update_module_permissions: {
        Args: {
          p_payload: Json
        }
        Returns: {
          success: boolean
          error?: string | null
        }
      }
      delete_sales_invoice: {
        Args: { company_id_param: string; invoice_id_param: string }
        Returns: Json
      }
      fetch_purchase_orders: {
        Args: {
          p_company_id: string
          p_is_super_admin: boolean
          p_level: string
          p_limit: number
          p_page: number
          p_search_query: string
          p_sort_by: string
          p_sort_order: string
          p_trail_status: string
          p_user_id: string
          p_user_role_id: string
        }
        Returns: {
          approval_status: Json
          approvers: Json
          category_id: string
          created_at: string
          created_by: string
          department_id: string
          id: string
          level: number
          multiple_approvers_enabled: boolean
          order_status: string
          po_number: string
          role_id: string
          status_sub_category_id: string
          status_value: string
          store_id: string
          supplier_id: string
          supplier_name: string
          total_count: number
          total_value: number
          workflow_id: string
        }[]
      }
      get_active_received_orders: {
        Args: never
        Returns: {
          po_number: string
        }[]
      }
      get_all_purchase_returns: {
        Args: {
          p_company_id: string
          p_page_number: number
          p_page_size: number
          p_search_term: string
          p_sort_direction: string
          p_sort_field: string
          p_status_filter: string
        }
        Returns: {
          approval_status: Json
          created_at: string
          created_by: string
          id: string
          po_number: string
          purchase_order_id: string
          purchase_return_number: string
          remark: string
          return_date: string
          return_status_category: string
          return_status_id: string
          return_status_sub_category: string
          return_status_value: string
          supplier_name: string
          total_count: number
          total_items: number
          total_value: number
        }[]
      }
      get_combined_inventory: {
        Args: {
          company_id: string
          page_number?: number
          page_size?: number
          search_term?: string
          sort_direction?: string
          sort_field?: string
        }
        Returns: {
          description: string
          expiry_date: string
          id: string
          item_category: string
          item_id: string
          item_name: string
          item_uuid: string
          purchase_order_id: string
          selling_price: number
          stock_date: string
          store_id: string
          total_count: number
          total_quantity: number
        }[]
      }
      get_consolidated_inventory: {
        Args: { po_id?: string; search_query?: string }
        Returns: {
          avg_selling_price: number
          avg_unit_price: number
          consolidated_ids: string[]
          expiry_date: string
          first_created_at: string
          first_stock_date: string
          item_id: string
          item_name: string
          latest_created_at: string
          latest_stock_date: string
          purchase_order_id: string
          record_count: number
          store_id: string
          total_quantity: number
        }[]
      }
      get_inventory_items: {
        Args: {
          company_id: string
          page_number: number
          page_size: number
          search_term: string
          sort_direction: string
          sort_field: string
        }
        Returns: {
          description: string
          expiry_date: string
          id: string
          item_category: string
          item_id: string
          item_name: string
          item_uuid: string
          purchase_order_id: string
          selling_price: number
          stock_date: string
          store_id: string
          total_count: number
          total_quantity: number
        }[]
      }
      get_inventory_items_for_reports: {
        Args: {
          company_id: string
          from_date?: string
          page_number?: number
          page_size?: number
          search_term?: string
          selected_stores?: string[]
          sort_direction?: string
          sort_field?: string
          to_date?: string
        }
        Returns: {
          description: string
          id: string
          item_category: string
          item_id: string
          item_name: string
          item_uuid: string
          store_id: string
          store_name: string
          total_count: number
          total_quantity: number
          unit_price: number
        }[]
      }
      get_invoice_items_grouped: {
        Args: { p_company_id: string; p_sales_invoice_id: string }
        Returns: {
          item_id: string
          item_name: string
          item_uuid: string
          quantity: number
        }[]
      }
      get_item_names_by_po_number: {
        Args: { po_number_input: string }
        Returns: {
          item_name: string
        }[]
      }
      get_item_stock_store_summary: {
        Args: {
          p_company_id: string
          p_item_id: string
          p_selected_store_id: string
        }
        Returns: {
          is_selected_store: boolean
          store_id: string
          store_name: string
          total_stock: number
        }[]
      }
      get_items_by_po_number: {
        Args: { po_number_input: string }
        Returns: {
          category_id: string
          description: string
          item_id: string
          item_name: string
          selling_price: number
        }[]
      }
      get_items_with_requisitions: {
        Args: {
          p_company_id: string
          p_status: string | null
          p_store_id: string | null
          p_category_type: string
          p_search: string | null
          p_item_page: number
          p_item_limit: number
          p_req_pagination: Json
        }
        Returns: Json
      }
      get_my_claims: { Args: never; Returns: string }
      get_order_and_received_qty: {
        Args: { po_number_input: string }
        Returns: {
          item_id: string
          order_qty: number
          received_qty: number
        }[]
      }
      get_orders_with_both_statuses: {
        Args: never
        Returns: {
          po_number: string
        }[]
      }
      get_pending_purchase_orders: {
        Args: {
          p_company_id: string
          p_is_super_admin: boolean
          p_limit: number
          p_page: number
          p_search_query?: string
          p_sort_by?: string
          p_sort_order?: string
          p_trail_status?: string
          p_user_id: string
          p_user_role_id: string
        }
        Returns: {
          approval_status: Json
          category_id: string
          created_at: string
          created_by: string
          id: string
          level: number
          order_status: string
          po_number: string
          role_id: string
          sub_category_id: string
          supplier_id: string
          supplier_name: string
          total_count: number
          total_value: number
          value: string
          workflow_id: string
        }[]
      }
      get_po_items_by_po_id: {
        Args: { po_id_input: string }
        Returns: {
          item_id: string
          item_name: string
        }[]
      }
      get_purchase_order_items:
        | {
            Args: { p_po_id: string }
            Returns: {
              item_id: string
              item_name: string
              order_price: number
              order_qty: number
              received_qty: number
              unit_price: number
            }[]
          }
        | {
            Args: { p_item_ids: string[]; p_po_id: string }
            Returns: {
              item_id: string
              item_name: string
              order_price: number
              order_qty: number
              received_qty: number
              unit_price: number
            }[]
          }
      get_purchase_order_items_detailed: {
        Args: { p_po_number: string }
        Returns: {
          item_created_at: string
          item_id: string
          order_price: number
          order_qty: number
          outstanding_qty: number
          po_number: string
          purchase_order_id: string
          received_qty: number
        }[]
      }
      get_purchase_orders_for_report: {
        Args: {
          p_company_id: string
          p_end_date?: string
          p_limit?: number
          p_page?: number
          p_search_query?: string
          p_sort_direction?: string
          p_sort_field?: string
          p_start_date?: string
          p_supplier_ids?: string[]
        }
        Returns: Json
      }
      get_purchase_orders_with_items:
        | {
            Args: {
              p_company_id: string
              p_end_date?: string
              p_limit?: number
              p_page?: number
              p_start_date?: string
              p_supplier_ids?: string[]
            }
            Returns: {
              approval_status: string
              id: string
              items: Json
              order_date: string
              payment_details: string
              po_number: string
              remarks: string
              store_address: string
              store_name: string
              supplier_address: string
              supplier_email: string
              supplier_id: string
              supplier_name: string
              system_message_config: Json
              total_items: number
              total_value: number
            }[]
          }
        | {
            Args: {
              p_company_id: string
              p_end_date: string
              p_limit?: number
              p_page?: number
              p_po_ids?: string[]
              p_start_date: string
              p_supplier_ids?: string[]
            }
            Returns: {
              approval_status: Json
              id: string
              is_active: boolean
              items: Json
              order_date: string
              payment_details: string
              po_number: string
              remarks: string
              store_address: string
              store_name: string
              supplier_address: string
              supplier_email: string
              supplier_id: string
              supplier_name: string
              system_message_config: Json
              total_items: number
              total_value: number
            }[]
          }
      get_purchase_requisitions_for_approval: {
        Args: {
          p_category_type?: string
          p_company_id: string
          p_is_super_admin: boolean
          p_limit?: number
          p_page?: number
          p_search?: string
          p_sort_dir?: string
          p_sort_field?: string
          p_user_id: string
          p_user_role_id: string
        }
        Returns: {
          approval_status: Json
          approval_users: Json
          category_type: string
          created_at: string
          created_by: string
          department: Json
          id: string
          last_status: string
          last_trail: string
          multiple_approvers_enabled: boolean
          next_level_role_id: string
          purchase_req_date: string
          purchase_req_number: string
          status: string
          status_value: string
          store: Json
          total_count: number
          total_items: number
          workflow_id: string
        }[]
      }
      get_purchase_requisitions_for_listing: {
        Args: {
          p_category_type?: string
          p_closed_limit?: number
          p_closed_page?: number
          p_company_id: string
          p_in_stock_limit?: number
          p_in_stock_page?: number
          p_is_super_admin: boolean
          p_limit?: number
          p_out_stock_limit?: number
          p_out_stock_page?: number
          p_page?: number
          p_search?: string
          p_sort_dir?: string
          p_sort_field?: string
          p_status?: string
          p_store_id?: string
          p_temp_limit?: number
          p_temp_page?: number
          p_user_id: string
        }
        Returns: {
          closed: {
            data: {
              approver_user: string
              available_qty: number | null
              category_type: string
              created_at: string
              created_by: string
              department: Json
              id: string
              is_temporary: boolean | null
              purchase_req_date: string
              purchase_req_number: string
              status: string
              status_value: string
              stock_status: string | null
              store: Json
              total_items: number
            }[]
            totalCount: number
          }
          inStock: {
            data: {
              approver_user: string
              available_qty: number | null
              category_type: string
              created_at: string
              created_by: string
              department: Json
              id: string
              is_temporary: boolean | null
              purchase_req_date: string
              purchase_req_number: string
              status: string
              status_value: string
              stock_status: string | null
              store: Json
              total_items: number
            }[]
            totalCount: number
          }
          outOfStock: {
            data: {
              approver_user: string
              available_qty: number | null
              category_type: string
              created_at: string
              created_by: string
              department: Json
              id: string
              is_temporary: boolean | null
              purchase_req_date: string
              purchase_req_number: string
              status: string
              status_value: string
              stock_status: string | null
              store: Json
              total_items: number
            }[]
            totalCount: number
          }
          temporaryItems: {
            data: {
              approver_user: string
              available_qty: number | null
              category_type: string
              created_at: string
              created_by: string
              department: Json
              id: string
              is_temporary: boolean | null
              purchase_req_date: string
              purchase_req_number: string
              status: string
              status_value: string
              stock_status: string | null
              store: Json
              total_items: number
            }[]
            totalCount: number
          }
        }
      }
      get_purchase_returns_by_status: {
        Args: {
          p_company_id: string
          p_is_super_admin: boolean
          p_limit?: number
          p_page?: number
          p_search_query?: string
          p_sort_by?: string
          p_sort_order?: string
          p_trail_status?: string
          p_user_id: string
          p_user_role_id: string
        }
        Returns: {
          approval_status: Json
          approval_users: Json
          company_id: string
          created_at: string
          created_by: string
          created_by_name: string
          department: Json
          id: string
          multiple_approvers_enabled: boolean
          next_level_role_id: string
          purchase_order_id: string
          purchase_retrun_number: string
          remark: string
          return_date: string
          return_status: string
          store: Json
          supplier_id: string
          supplier_name: string
          total_count: number
          total_items: number
          total_value: number
          workflow_id: string
        }[]
      }
      get_return_eligible_pos_from_inventory: {
        Args: {
          p_company_id: string
          p_date_from?: string
          p_date_to?: string
          p_page?: number
          p_page_size?: number
          p_search_term?: string
          p_sort_direction?: string
          p_sort_field?: string
          p_status_filter?: string
        }
        Returns: {
          created_by_name: string
          id: string
          order_status: string
          order_status_name: string
          po_number: string
          received_on: string
          returnable_items: number
          supplier_email: string
          supplier_name: string
          total_count: number
          total_items: number
          total_value: number
        }[]
      }
      get_sales_invoice_by_id: {
        Args: { company_id_param: string; invoice_id_param: string }
        Returns: Json
      }
      get_sales_invoices_paginated: {
        Args: {
          company_id_param: string
          date_from?: string
          date_to?: string
          limit_param?: number
          page?: number
          search_query?: string
          sort_field?: string
          sort_order?: string
          status_filter?: string
        }
        Returns: Json
      }
      get_sales_returns_for_approval: {
        Args: {
          p_company_id: string
          p_is_super_admin: boolean
          p_limit?: number
          p_page?: number
          p_search?: string
          p_sort_dir?: string
          p_sort_field?: string
          p_user_id: string
          p_user_role_id: string
        }
        Returns: {
          approval_status: Json
          approval_users: Json
          created_at: string
          created_by: string
          department: Json
          id: string
          last_status: string
          last_trail: string
          multiple_approvers_enabled: boolean
          next_level_role_id: string
          return_date: string
          return_status: string
          sales_return_number: string
          status_value: string
          store: Json
          total_count: number
          total_items: number
          workflow_id: string
        }[]
      }
      get_status_list: {
        Args: never
        Returns: {
          sub_category_id: string
        }[]
      }
      get_store_ids_from_purchase_orders: {
        Args: { p_company_id: string }
        Returns: string[]
      }
      get_supplier_ids_from_purchase_orders: {
        Args: { p_company_id: string }
        Returns: string[]
      }
      get_total_stock_for_items: {
        Args: { item_ids: string[] }
        Returns: {
          item_id: string
          total_qty: number
        }[]
      }
      get_total_stock_for_items_by_store: {
        Args: { item_ids: string[]; p_store_id: string }
        Returns: {
          item_id: string
          total_qty: number
        }[]
      }
      get_workflow_levels_with_approvers: {
        Args: {
          p_company_id: string
          p_department_id: string
          p_module_key: string
          p_action_name: string
          p_assigned_to: string
          p_store_id: string
        }
        Returns: {
          approver_ids: string[]
          has_approvers: boolean
          level: number
          process_name: string
          role_id: string
          workflow_id: string
        }[]
      }
      process_purchase_return: {
        Args: { p_po_number: string; p_return_items: Json }
        Returns: {
          message: string
          return_id: number
          success: boolean
        }[]
      }
      restore_inventory_qty: {
        Args: { inc_qty: number; inv_id: string }
        Returns: undefined
      }
      save_workflow_configuration_transaction: {
        Args: {
          p_payload: Json
        }
        Returns: {
          success: boolean
          error?: string | null
        }
      }
      test_jwt_claims: { Args: never; Returns: string }
      validate_next_level_workflow_approvers: {
        Args: {
          p_company_id: string
          p_current_level: number
          p_department_id: string
          p_module_key: string
          p_action_name: string
          p_assigned_to: string
          p_store_id: string
        }
        Returns: {
          approver_ids: string[]
          has_approvers: boolean
          next_level: number
          next_role_id: string
          next_workflow_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      purchase_order_list_result: {
        id: string | null
        po_number: string | null
        supplier_id: string | null
        created_at: string | null
        total_value: number | null
        order_status: string | null
        approval_status: Json | null
        workflow_id: string | null
        supplier_name: string | null
        status_value: string | null
        status_category_id: string | null
        status_sub_category_id: string | null
        workflow_role_id: string | null
        workflow_level: number | null
        total_count: number | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
