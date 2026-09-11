export default function Image({
  src,
  alt = "",
  fill = false,
  width,
  height,
  className = "",
  priority = false,
  style = {},
  ...props
}) {
  const imageSrc = typeof src === "object" && src !== null ? src.src : src;

  const combinedStyle = fill
    ? {
        position: "absolute",
        height: "100%",
        width: "100%",
        inset: 0,
        color: "transparent",
        ...style,
      }
    : style;

  return (
    <img
      src={imageSrc}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      loading={priority ? "eager" : "lazy"}
      className={className}
      style={combinedStyle}
      {...props}
    />
  );
}
