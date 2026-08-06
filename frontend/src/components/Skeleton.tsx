interface SkeletonProps {
  variant?: 'text' | 'circle' | 'rectangle' | 'card';
  width?: string | number;
  height?: string | number;
  count?: number;
  className?: string;
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  count = 1,
  className = '',
}: SkeletonProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case 'circle':
        return 'rounded-full';
      case 'rectangle':
        return 'rounded-xl';
      case 'card':
        return 'rounded-2xl border border-gray-800 p-5';
      case 'text':
      default:
        return 'rounded-lg h-4 w-full';
    }
  };

  const skeletons = Array.from({ length: count });

  return (
    <>
      {skeletons.map((_, index) => {
        // Build style object dynamically if width/height are specified
        const style: React.CSSProperties = {};
        if (width !== undefined) style.width = typeof width === 'number' ? `${width}px` : width;
        if (height !== undefined) style.height = typeof height === 'number' ? `${height}px` : height;

        if (variant === 'card') {
          return (
            <div
              key={index}
              className={`animate-pulse bg-gray-850 flex flex-col gap-3 ${getVariantClasses()} ${className}`}
              style={style}
            >
              <div className="h-4 w-1/3 rounded bg-gray-700" />
              <div className="h-6 w-2/3 rounded bg-gray-700" />
              <div className="h-4 w-full rounded bg-gray-700" />
            </div>
          );
        }

        return (
          <div
            key={index}
            className={`animate-pulse bg-gray-700/60 ${getVariantClasses()} ${className}`}
            style={style}
          />
        );
      })}
    </>
  );
}

export default Skeleton;
