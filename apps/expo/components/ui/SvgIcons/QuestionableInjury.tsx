import * as React from "react";
import Svg, { SvgProps, Path, Rect, Circle } from "react-native-svg";
const SvgQuestionableInjury = (props: SvgProps) => (
  <Svg
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    role="img"
    {...props}
  >
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12Zm11 4v2h-2v-2h2Zm-1 4c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8ZM8 10c0-2.21 1.79-4 4-4s4 1.79 4 4c0 1.283-.79 1.973-1.56 2.646C13.712 13.283 13 13.905 13 15h-2c0-1.821.942-2.543 1.77-3.178.65-.498 1.23-.943 1.23-1.822 0-1.1-.9-2-2-2s-2 .9-2 2H8Z"
      fill="#212121"
    />
  </Svg>
);

export default SvgQuestionableInjury;
