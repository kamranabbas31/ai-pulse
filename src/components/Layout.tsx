
import { FC, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  SidebarProvider, 
  SidebarInset, 
  SidebarTrigger 
} from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { toast } from "sonner";

interface LayoutProps {
  children: ReactNode;
}

const Layout: FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <AppSidebar currentPath={location.pathname} />
        <SidebarInset className="flex-1">
          <header className="bg-white border-b h-16 flex items-center justify-between px-8 sticky top-0 z-40">
            <SidebarTrigger className="h-8 w-8" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src="/lovable-uploads/620a3236-a743-4779-8cde-07f0a587c6ed.png" alt="User" />
                    <AvatarFallback>
                      <User className="h-6 w-6" />
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-sm">
                  <span>conversionmediagroup</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-sm cursor-pointer flex items-center text-red-500 focus:text-red-500">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main className="py-6 px-8 overflow-auto">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Layout;
