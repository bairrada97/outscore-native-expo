import * as React from "react";
import Svg, { SvgProps, Path } from "react-native-svg";
const SvgClose = (props: SvgProps) => (
  <Svg
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    role="img"
    {...props}
  >
    <Path
      d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z"
      fill="currentColor"
    />
  </Svg>
);

export default SvgClose;
