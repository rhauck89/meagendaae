import { cn } from '@/lib/utils';

interface ContentContainerProps {
  children: React.ReactNode;
  className?: string;
}

const ContentContainer = ({ children, className }: ContentContainerProps) => (
  <div className={cn('flex flex-col gap-4 w-full', className)}>
    {children}
  </div>
);

export default ContentContainer;
