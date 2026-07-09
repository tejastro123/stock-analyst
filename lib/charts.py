import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pandas as pd
import numpy as np

def split_traces(df: pd.DataFrame, col_name: str, baseline: float):
    """
    Splits a time series into two separate traces (above and below a baseline)
    using linear interpolation at the crossing points. This ensures line segments
    end/start exactly at the baseline.
    """
    above_x, above_y = [], []
    below_x, below_y = [], []
    
    times = df.index
    values = df[col_name].values
    
    if len(values) == 0:
        return ([], []), ([], [])
        
    for i in range(len(values) - 1):
        t1, y1 = times[i], values[i]
        t2, y2 = times[i+1], values[i+1]
        
        # Add current point to appropriate trace
        if y1 >= baseline:
            above_x.append(t1)
            above_y.append(y1)
        else:
            below_x.append(t1)
            below_y.append(y1)
            
        # Check for zero crossing
        if (y1 >= baseline and y2 < baseline) or (y1 < baseline and y2 >= baseline):
            # Interpolate exact crossing point
            ts1 = pd.to_datetime(t1).timestamp()
            ts2 = pd.to_datetime(t2).timestamp()
            fraction = (baseline - y1) / (y2 - y1)
            tsc = ts1 + (ts2 - ts1) * fraction
            tc = pd.to_datetime(tsc, unit='s', utc=True)
            
            # Append crossing point to both to align them
            above_x.append(tc)
            above_y.append(baseline)
            below_x.append(tc)
            below_y.append(baseline)
            
            # Break lines with None so they don't form a loop
            above_x.append(None)
            above_y.append(None)
            below_x.append(None)
            below_y.append(None)
            
    # Add final point
    if values[-1] >= baseline:
        above_x.append(times[-1])
        above_y.append(values[-1])
    else:
        below_x.append(times[-1])
        below_y.append(values[-1])
        
    return (above_x, above_y), (below_x, below_y)

def render_price_chart(df: pd.DataFrame, ticker: str, view_type: str = "Candlestick", baseline_price: float = None):
    """
    Renders a premium dual-axis Plotly chart (Price/Performance + Volume overlay).
    
    Views:
    - Candlestick: Classic OHLC candles with colored volume bar chart.
    - Price: Clean line chart.
    - Performance: % change relative to start of period or baseline_price (0% baseline).
    - Area: Gradient fill split green/red at baseline_price (or start price).
    """
    if df.empty:
        fig = go.Figure()
        fig.update_layout(
            template="plotly_dark",
            title=f"No data available for {ticker}",
            xaxis={"visible": False},
            yaxis={"visible": False}
        )
        return fig

    # Standardize baseline price
    start_price = df["Close"].iloc[0]
    if baseline_price is None:
        baseline = start_price
    else:
        baseline = baseline_price

    # Setup dual-axis figure (Main Chart top, Volume bottom)
    fig = make_subplots(
        rows=2, cols=1, 
        shared_xaxes=True, 
        vertical_spacing=0.03, 
        row_heights=[0.8, 0.2]
    )

    last_time = df.index[-1]
    last_price = df["Close"].iloc[-1]
    
    # Calculate end of period returns
    if view_type == "Performance":
        base_perf = baseline
        total_return = ((last_price - base_perf) / base_perf) * 100
        badge_text = f" {total_return:+.2f}% "
        y_val = total_return
    else:
        total_return = ((last_price - baseline) / baseline) * 100
        badge_text = f" {total_return:+.2f}% "
        y_val = last_price

    badge_color = "#26a69a" if total_return >= 0 else "#ef5350"
    
    # Render main price trace
    if view_type == "Candlestick":
        fig.add_trace(
            go.Candlestick(
                x=df.index,
                open=df["Open"], high=df["High"],
                low=df["Low"], close=df["Close"],
                name="OHLC",
                increasing_line_color="#26a69a", decreasing_line_color="#ef5350",
                increasing_fillcolor="#26a69a", decreasing_fillcolor="#ef5350",
                showlegend=False
            ),
            row=1, col=1
        )
    elif view_type == "Price":
        fig.add_trace(
            go.Scatter(
                x=df.index, y=df["Close"],
                mode="lines",
                line=dict(color="#3b82f6", width=2),
                name="Price",
                showlegend=False
            ),
            row=1, col=1
        )
        # Add baseline line
        fig.add_shape(
            type="line",
            x0=df.index[0], x1=df.index[-1],
            y0=baseline, y1=baseline,
            line=dict(color="gray", width=1, dash="dash"),
            row=1, col=1
        )
    elif view_type == "Performance":
        # Calculate % returns relative to baseline
        df_perf = df.copy()
        df_perf["Perf"] = ((df_perf["Close"] - baseline) / baseline) * 100
        
        # Split performance trace at 0%
        (gx, gy), (rx, ry) = split_traces(df_perf, "Perf", 0.0)
        
        fig.add_trace(
            go.Scatter(
                x=gx, y=gy,
                mode="lines",
                line=dict(color="#26a69a", width=2),
                name="Positive Return",
                connectgaps=False,
                showlegend=False
            ),
            row=1, col=1
        )
        fig.add_trace(
            go.Scatter(
                x=rx, y=ry,
                mode="lines",
                line=dict(color="#ef5350", width=2),
                name="Negative Return",
                connectgaps=False,
                showlegend=False
            ),
            row=1, col=1
        )
        # Add 0% baseline shape
        fig.add_shape(
            type="line",
            x0=df.index[0], x1=df.index[-1],
            y0=0.0, y1=0.0,
            line=dict(color="gray", width=1, dash="dash"),
            row=1, col=1
        )
    elif view_type == "Area":
        # Split prices at baseline
        (gx, gy), (rx, ry) = split_traces(df, "Close", baseline)
        
        # Positive Area
        fig.add_trace(
            go.Scatter(
                x=gx, y=gy,
                mode="lines",
                line=dict(color="#26a69a", width=1.5),
                fill="tozeroy",
                fillcolor="rgba(38, 166, 154, 0.12)",
                name="Above Baseline",
                connectgaps=False,
                showlegend=False
            ),
            row=1, col=1
        )
        # Negative Area
        fig.add_trace(
            go.Scatter(
                x=rx, y=ry,
                mode="lines",
                line=dict(color="#ef5350", width=1.5),
                fill="tozeroy",
                fillcolor="rgba(239, 83, 80, 0.12)",
                name="Below Baseline",
                connectgaps=False,
                showlegend=False
            ),
            row=1, col=1
        )
        # Add baseline line
        fig.add_shape(
            type="line",
            x0=df.index[0], x1=df.index[-1],
            y0=baseline, y1=baseline,
            line=dict(color="gray", width=1, dash="dash"),
            row=1, col=1
        )

    # Render Volume bar chart on bottom axis (Row 2)
    # Color volume bars based on whether close was up or down
    vol_colors = []
    for i in range(len(df)):
        if i == 0:
            vol_colors.append("#26a69a")
        else:
            if df["Close"].iloc[i] >= df["Close"].iloc[i-1]:
                vol_colors.append("#26a69a")
            else:
                vol_colors.append("#ef5350")
                
    fig.add_trace(
        go.Bar(
            x=df.index, y=df["Volume"],
            marker_color=vol_colors,
            opacity=0.5,
            name="Volume",
            showlegend=False
        ),
        row=2, col=1
    )

    # Add Return Badge anchored to last point
    fig.add_annotation(
        x=last_time,
        y=y_val,
        text=badge_text,
        showarrow=True,
        arrowhead=0,
        arrowcolor=badge_color,
        ax=45,
        ay=0,
        font=dict(color="white", size=12, family="monospace"),
        bgcolor=badge_color,
        bordercolor=badge_color,
        borderwidth=1,
        borderpad=4,
        row=1, col=1
    )

    # Apply premium layout details
    fig.update_layout(
        template="plotly_dark",
        plot_bgcolor="#131722",
        paper_bgcolor="#131722",
        xaxis=dict(
            rangeslider=dict(visible=False),
            gridcolor="#2a2e39",
            linecolor="#2a2e39"
        ),
        xaxis2=dict(
            gridcolor="#2a2e39",
            linecolor="#2a2e39"
        ),
        yaxis=dict(
            gridcolor="#2a2e39",
            linecolor="#2a2e39",
            title="Price / Perf" if view_type == "Performance" else "Price ($)",
            side="right"
        ),
        yaxis2=dict(
            gridcolor="#2a2e39",
            linecolor="#2a2e39",
            title="Volume",
            side="right"
        ),
        margin=dict(l=20, r=60, t=30, b=20),
        height=450,
        hovermode="x unified"
    )

    return fig
