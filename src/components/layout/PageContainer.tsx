import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

const PageContainer = ({ children, className }: PageContainerProps) => (
  <div className={cn('w-full max-w-[1400px] mx-auto px-3 sm:px-4 lg:px-6 box-border', className)}>
    {children}
  </div>
);

export default PageContainer;
