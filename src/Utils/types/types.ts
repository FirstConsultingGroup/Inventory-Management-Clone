export interface IUser {
    active: boolean;
    createdAt: string;
    email: string;
    firstName: string;
    lastName: string;
    role: {
      _id: string;
      role_name: string;
    };
    status: string;
    updatedAt: string;
    username: string;
    __v?: number;
    _id: string;
  }
  export interface IStoreManager {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
  }
  export interface IParentStore {
    _id: string;
    storeName: string;
    storeType: "Central Store" | "Branch Store" | "Sub Branch";
  }
  export interface IStore {
    _id: string;
    id?: string; // Alias for _id, included as per data
    storeId: string;
    storeName: string;
    address: string;
    phoneNumber: string;
    email: string;
    storeType: "Central Store" | "Branch Store" | "Sub Branch";
    storeManager?: IStoreManager; // Optional, as it may not always be assigned
    parentStore?: IParentStore | null; // Optional, required only for Branch/Sub Branch
    bankName: string;
    bankAccountNumber: string;
    bankCode: string;
    swiftCode?: string; // Optional, as per Zod schema
    govtTaxId: string;
    allowDirectPurchase: boolean;
    active: boolean;
    createdAt?: string; // ISO date string
    updatedAt?: string; // ISO date string
    __v?: number; // Mongoose version key
  }
