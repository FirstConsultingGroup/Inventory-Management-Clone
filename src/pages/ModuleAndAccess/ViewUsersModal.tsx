import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Pencil } from "lucide-react"

interface UsersModalProps {
    open: boolean;
    onClose: (open: boolean) => void;
    groupedUsers: any[];
    setGroupedUsers: React.Dispatch<React.SetStateAction<any[]>>;
    setUserId: React.Dispatch<React.SetStateAction<string>>;
    setLoadPermission: React.Dispatch<React.SetStateAction<boolean>>;
}

export const ViewUsersModal = ({
  open,
  onClose,
  groupedUsers,
  setGroupedUsers,
  setUserId,
  setLoadPermission
}: UsersModalProps) => {
    


return(
<Dialog open={open} onOpenChange={(open) => {
            if (!open) {
                setGroupedUsers([])
            }
            onClose(open);
        }}>
                    <DialogContent className="sm:max-w-xl">
                        <DialogHeader>
                            <DialogTitle className='font-semibold'>Manage Group Users</DialogTitle>
                            <DialogDescription>Choose a user to update their specific module permissions.</DialogDescription>
                        </DialogHeader>

                        <div className="max-h-[500px] overflow-y-auto shadow mr-1">
                            {groupedUsers.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-[250px] text-center">
                                    <p className="text-gray-500 font-medium">
                                        No Users found
                                    </p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader className="bg-gray-100">
                                        <TableRow>
                                            <TableHead className="w-[80px] ps-3">User</TableHead>
                                            <TableHead>Details</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {groupedUsers.map((u) => (
                                            <TableRow key={u.id} className="">
                                                <TableCell className="font-medium">
                                                    <div className="w-9 h-8 rounded-full p-1 bg-blue-100 flex items-center justify-center text-blue-700 font-medium">
                                            {u.first_name?.[0]}{u.last_name?.[0]}
                                        </div>
                                                </TableCell>

                                                <TableCell>
                                                    <div className="flex flex-col items-start gap-1">
                                                    <h3 className="font-medium text-gray-700 capitalize">{u.first_name}{''}{u.last_name}</h3>
                                                     <span className="text-xs text-gray-500 font-semibold">{u.email}</span>
                                                     </div>
                                                </TableCell>
                                                
                                                <TableCell>
                                                    <span className="bg-blue-50 text-xs font-semibold border border-blue-200 text-blue-600 rounded-lg px-2 py-1">{u.role_name}</span>
                                                </TableCell>

                                                <TableCell>
                                                    <span key={u.id} className="flex items-center justify-end pr-2">
                                                    <Pencil onClick={()=>{
                                                        setUserId(u.id);
                                                        setLoadPermission(true);
                                                        onClose(open);
                                                        setGroupedUsers([]);
                                                        }} className="border rounded-md h-7 w-7 p-1.5 text-gray-700 hover:text-blue-500 hover:bg-blue-50 hover:border-blue-200 transition-colors duration-200 shadow"/>
                                                    </span>
                                                </TableCell>

                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                        
                    </DialogContent>
                </Dialog>

                        )
                    }