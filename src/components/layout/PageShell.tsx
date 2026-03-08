import { PixelIcon, type PixelIconProps } from "@/components/pixel";

interface PageShellProps {
  title: string;
  icon?: PixelIconProps;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageShell({ title, icon, children, actions }: PageShellProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="border-b-2 border-[#1A202C] bg-white px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          {icon && <PixelIcon {...icon} size={16} />}
          <h1 className="text-xs font-bold uppercase tracking-widest text-[#1A202C]">
            {title}
          </h1>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="flex-1 overflow-auto p-6">{children}</div>
    </div>
  );
}
